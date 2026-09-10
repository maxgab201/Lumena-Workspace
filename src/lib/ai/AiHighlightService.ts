import { PageSegmentInventory, type PageSegment } from '../processing/PageSegmentInventory';
import { OcrService } from '../processing/OcrService';
import { supabase } from '../supabase';
import type { Highlight, NormalizedRect } from '../../types/highlights';

/**
 * AI Highlight Service (Checkpoint 3).
 *
 * Flow: PDF → per-page text inventory (native PDF.js + OCR for scanned pages)
 * → AI selects SEMANTIC segment_keys (never geometry) → client maps the keys
 * back to canonical geometry from the inventory → creates ordinary highlights
 * with source='ai'. Everything reuses the approved Checkpoint 2 highlight
 * system: canonical geometry, rotation, zoom, notes, persistence, delete.
 *
 * Billing is intentionally NOT wired in this checkpoint.
 */

export type AiDensity = 'low' | 'normal' | 'high';
export type AiScope = 'page' | 'document';

export interface AiHighlightProgress {
  phase: 'inventory' | 'ocr' | 'analyzing' | 'matching' | 'done';
  detail?: string;
  pagesTotal?: number;
  pagesDone?: number;
  ocrPageNumber?: number;
}

export interface AiHighlightSummary {
  created: number;
  failedPages: Array<{ page: number; error: string }>;
  usedOcr: boolean;
  ocrPages: number;
  nativePages: number;
}

interface StoredSegmentRow {
  segment_key: string;
  page_number: number;
  text: string;
  rects: NormalizedRect[];
  origin: 'native' | 'ocr';
  sequence: number;
}

const AI_HIGHLIGHT_COLORS = [
  '#93c5fd', // blue    — ideas / definitions
  '#fef08a', // yellow  — concepts
  '#86efac', // green   — facts
  '#fca5a5', // red     — dates / warnings
  '#c4b5fd', // purple  — summaries
];

const CATEGORY_COLOR: Record<string, string> = {
  idea: '#93c5fd',
  definition: '#93c5fd',
  concept: '#fef08a',
  'key-term': '#fef08a',
  date: '#fca5a5',
  warning: '#fca5a5',
  fact: '#86efac',
  name: '#86efac',
  summary: '#c4b5fd',
  relationship: '#fbbf24',
  example: '#fbbf24',
};

export class AiHighlightService {
  /**
   * Analyze the current page or the whole document and create AI highlights.
   * Whole-document mode processes page blocks sequentially to keep requests
   * bounded — never one giant request.
   */
  static async highlightDocument(params: {
    file: File | Blob;
    documentId: string;
    workspaceId: string;
    scope: AiScope;
    pageNumber?: number; // 1-based, required when scope='page'
    density: AiDensity;
    onProgress?: (p: AiHighlightProgress) => void;
  }): Promise<AiHighlightSummary> {
    const { file, documentId, workspaceId, scope, density, onProgress } = params;

    // ─── 1. Build/refresh the native inventory for the target pages ───
    onProgress?.({ phase: 'inventory' });
    const targetPages = scope === 'page' && params.pageNumber
      ? [params.pageNumber]
      : null; // null = all pages, discovered after the first pass

    let nativeSegments: PageSegment[] = [];
    let scannedPages: number[] = [];

    if (targetPages) {
      const { perPage, segments } = await PageSegmentInventory.buildNativeInventory(file, {
        pages: targetPages,
      });
      const inv = perPage[0];
      nativeSegments = segments;
      if (!inv.hasNativeText) scannedPages = [inv.page_number];
    } else {
      // Full document: inventory every page, remember which need OCR
      const inventoryResult = await PageSegmentInventory.buildNativeInventory(file, {
        onPage: (pageNumber, info) => {
          onProgress?.({
            phase: 'inventory',
            pagesDone: pageNumber,
            detail: info.hasNativeText ? 'con texto' : 'requiere OCR',
          });
        },
      });
      nativeSegments = inventoryResult.segments;
      scannedPages = inventoryResult.perPage.filter((p) => !p.hasNativeText).map((p) => p.page_number);
      onProgress?.({ phase: 'inventory', pagesTotal: inventoryResult.totalPages, pagesDone: inventoryResult.totalPages });
    }

    // ─── 2. OCR the scanned pages (real OCR, real bounding boxes) ───
    let ocrSegments: PageSegment[] = [];
    const failedPages: Array<{ page: number; error: string }> = [];
    let usedOcr = false;

    if (scannedPages.length > 0) {
      usedOcr = true;
      onProgress?.({ phase: 'ocr', pagesTotal: scannedPages.length, pagesDone: 0 });
      const results = await OcrService.ocrPages(
        file, documentId, workspaceId, scannedPages,
        (p) => onProgress?.({
          phase: 'ocr',
          pagesTotal: p.totalPages,
          pagesDone: p.completedPages,
          ocrPageNumber: p.page_number,
        }),
      );
      for (const r of results) {
        if (!r.success) failedPages.push({ page: r.page_number, error: r.error ?? 'OCR failed' });
      }
      // Reload the OCR segments we just persisted
      const { data: ocrRows, error: ocrLoadError } = await supabase
        .from('document_page_segments')
        .select('segment_key, page_number, text, rects, origin, sequence')
        .eq('document_id', documentId)
        .eq('origin', 'ocr')
        .in('page_number', scannedPages)
        .order('page_number')
        .order('sequence');
      if (ocrLoadError) {
        console.error('[AiHighlight] Failed to load OCR segments:', ocrLoadError);
        throw new Error('No se pudo leer el texto reconocido por OCR.');
      }
      ocrSegments = (ocrRows ?? []) as unknown as StoredSegmentRow[];
    }

    // ─── 3. Analyze with AI, page block by page block ───
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Tu sesión expiró. Iniciá sesión de nuevo.');

    const allSegments = [...nativeSegments, ...ocrSegments];
    const byPage = new Map<number, PageSegment[]>();
    for (const seg of allSegments) {
      const list = byPage.get(seg.page_number) ?? [];
      list.push(seg);
      byPage.set(seg.page_number, list);
    }

    const createdHighlights: Highlight[] = [];
    let analyzedOcrPages = 0;

    const pageBlocks = scope === 'page' && params.pageNumber
      ? [params.pageNumber]
      : [...byPage.keys()].sort((a, b) => a - b);

    for (const pageNumber of pageBlocks) {
      const pageSegs = byPage.get(pageNumber) ?? [];
      if (pageSegs.length === 0) continue;
      if (pageSegs.some((s) => s.origin === 'ocr')) analyzedOcrPages++;

      onProgress?.({ phase: 'analyzing', detail: `Página ${pageNumber}`, pagesTotal: pageBlocks.length, pagesDone: pageNumber });

      // Build the semantic inventory for this page block
      const inventory = pageSegs.map((s) => ({
        segment_key: s.segment_key,
        text: s.text,
        sequence: s.sequence,
      }));

      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-highlight`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            document_id: documentId,
            workspace_id: workspaceId,
            page_number: pageNumber,
            segments: inventory,
            density,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message = data?.error || `AI request failed (${res.status})`;
          // A failing AI page must never break the reader or other pages
          failedPages.push({ page: pageNumber, error: message });
          continue;
        }

        // ─── 4. Map semantic selections → canonical geometry ───
        const segByKey = new Map(pageSegs.map((s) => [s.segment_key, s]));
        onProgress?.({ phase: 'matching', detail: `Página ${pageNumber}` });

        for (const selection of (data.selections ?? []) as Array<{
          segment_key: string; category: string; confidence: number;
        }>) {
          const segment = segByKey.get(selection.segment_key);
          if (!segment || segment.text.trim().length === 0) continue; // unknown key → ignore, never invent geometry

          const canonicalRects = segment.rects;
          if (!canonicalRects || canonicalRects.length === 0) continue;

          const color = CATEGORY_COLOR[selection.category] ?? AI_HIGHLIGHT_COLORS[0];
          const created = await createAiHighlight({
            document_id: documentId,
            workspace_id: workspaceId,
            page_index: pageNumber - 1,
            rects: canonicalRects,
            text: segment.text,
            color,
            note: null,
            source: 'ai',
            ai_metadata: {
              category: selection.category,
              confidence: selection.confidence,
              origin: segment.origin,
              model: data.model,
            },
          });
          if (created) createdHighlights.push(created);
        }
      } catch (err) {
        console.error(`[AiHighlight] Page ${pageNumber} analysis failed:`, err);
        failedPages.push({
          page: pageNumber,
          error: err instanceof Error ? err.message : 'AI analysis failed',
        });
      }
    }

    onProgress?.({ phase: 'done' });

    return {
      created: createdHighlights.length,
      failedPages,
      usedOcr,
      ocrPages: scannedPages.length,
      nativePages: (scope === 'page' ? targetPages!.length : (byPage.size - analyzedOcrPages)),
    };
  }
}

/** Thin wrapper so this module does not import the store directly (avoids cycles). */
type AddHighlightInput = Parameters<ReturnType<typeof import('../../stores/highlightStore').useHighlightStore.getState>['addHighlight']>[0];

async function createAiHighlight(payload: {
  document_id: string; workspace_id: string; page_index: number;
  rects: NormalizedRect[]; text: string; color: string; note: string | null;
  source: 'manual' | 'ai'; ai_metadata?: Record<string, unknown>;
}): Promise<Highlight | null> {
  const { useHighlightStore } = await import('../../stores/highlightStore');
  const input: AddHighlightInput = {
    document_id: payload.document_id,
    workspace_id: payload.workspace_id,
    page_index: payload.page_index,
    rects: payload.rects,
    text: payload.text,
    color: payload.color,
    note: payload.note ?? undefined,
    source: payload.source,
    ai_metadata: payload.ai_metadata,
  };
  return useHighlightStore.getState().addHighlight(input);
}
