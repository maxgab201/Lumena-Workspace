import { pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  SentenceInventory,
  matchQuote,
  rectsForWordRange,
  type Sentence,
} from './SentenceInventory';
import { OcrService } from '../processing/OcrService';
import { supabase } from '../supabase';
import type { Highlight, NormalizedRect } from '../../types/highlights';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * AI Highlight Service (Checkpoint 3 — semantic quality rework).
 *
 * Flow: PDF → sentence inventory with WORD-level real geometry (native PDF.js
 * items split into words; OCR words from Tesseract) → AI selects sentences and
 * narrows each to an exact QUOTE → client verifies the quote exists in the
 * sentence (strict normalization) → quote → word range → per-line canonical
 * rects → ordinary highlights with source='ai'.
 *
 * The AI never sees or outputs geometry. Quotes that don't verify are dropped
 * — never approximated. Density drives a coverage budget enforced server-side.
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

interface AiSelection {
  sentence_key: string;
  quote: string;
  category: string;
  confidence: number;
}

const CATEGORY_COLOR: Record<string, string> = {
  main_idea: '#93c5fd',  // blue   — ideas / arguments
  definition: '#93c5fd', // blue   — definitions
  key_fact: '#86efac',   // green  — facts / data
  date: '#fca5a5',       // red    — dates
  person: '#fef08a',     // yellow — names / people
  formula: '#c4b5fd',    // purple — formulas
};

export class AiHighlightService {
  static async highlightDocument(params: {
    file: File | Blob;
    documentId: string;
    workspaceId: string;
    scope: AiScope;
    pageNumber?: number;
    density: AiDensity;
    onProgress?: (p: AiHighlightProgress) => void;
  }): Promise<AiHighlightSummary> {
    const { file, documentId, workspaceId, scope, density, onProgress } = params;

    // ─── 1. Sentence inventory (native) for the target pages ───
    onProgress?.({ phase: 'inventory' });
    const targetPages = scope === 'page' && params.pageNumber
      ? [params.pageNumber]
      : undefined;

    let scannedPages: number[] = [];
    const sentencesByPage = new Map<number, Sentence[]>();

    const native = await SentenceInventory.buildNativeSentences(file, targetPages, (pageNumber, info) => {
      onProgress?.({ phase: 'inventory', pagesDone: pageNumber, detail: info.hasNativeText ? 'con texto' : 'requiere OCR' });
    });
    scannedPages = native.scannedPages;
    for (const p of native.perPage) {
      sentencesByPage.set(p.page_number, p.sentences);
    }
    if (scope === 'document') {
      onProgress?.({ phase: 'inventory', pagesTotal: native.totalPages, pagesDone: native.totalPages });
    }

    // ─── 2. OCR the scanned pages → sentence inventory from real words ───
    const failedPages: Array<{ page: number; error: string }> = [];
    let usedOcr = false;

    if (scannedPages.length > 0) {
      usedOcr = true;
      onProgress?.({ phase: 'ocr', pagesTotal: scannedPages.length, pagesDone: 0 });
      const results = await OcrService.ocrWordsForPages(
        file, scannedPages,
        (p) => onProgress?.({
          phase: 'ocr',
          pagesTotal: p.totalPages,
          pagesDone: p.completedPages,
          ocrPageNumber: p.page_number,
        }),
      );
      for (const r of results) {
        if (!r.success) failedPages.push({ page: r.page_number, error: r.error ?? 'OCR failed' });
        continue;
      }
      // Persist word-level segments for the existing DB table (observability)
      await OcrService.persistOcrSegments(documentId, workspaceId, results);
      // Build sentence units from the REAL OCR words + bboxes
      for (const r of results) {
        if (!r.success || !r.words || !r.rasterWidth || !r.rasterHeight) continue;
        const pageSentences = SentenceInventory.buildOcrSentences(
          r.page_number, r.words, r.rasterWidth, r.rasterHeight,
        );
        sentencesByPage.set(r.page_number, pageSentences.sentences);
      }
    }

    // ─── 3. Analyze page by page (bounded requests) ───
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Tu sesión expiró. Iniciá sesión de nuevo.');

    const createdHighlights: Highlight[] = [];
    const pageBlocks = scope === 'page' && params.pageNumber
      ? [params.pageNumber]
      : [...sentencesByPage.keys()].sort((a, b) => a - b);

    // Re-run semantics: an AI analysis REPLACES the previous AI highlights of
    // the analyzed scope (manual highlights are never touched). This prevents
    // duplicates accumulating across repeated runs.
    const store = (await import('../../stores/highlightStore')).useHighlightStore.getState();
    const removedIds = new Set<string>();
    for (const h of store.highlights[documentId] ?? []) {
      if (h.source !== 'ai') continue;
      const inScope = scope === 'page' ? h.page_index === (params.pageNumber ?? -1) - 1 : true;
      if (inScope && !removedIds.has(h.id)) {
        removedIds.add(h.id);
        await store.removeHighlight(h.id);
      }
    }

    for (const pageNumber of pageBlocks) {
      const pageSentences = sentencesByPage.get(pageNumber) ?? [];
      if (pageSentences.length === 0) continue;

      onProgress?.({ phase: 'analyzing', detail: `Página ${pageNumber}`, pagesTotal: pageBlocks.length, pagesDone: pageNumber });

      const inventory = pageSentences.map((s) => ({ sentence_key: s.sentence_key, text: s.text }));

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
            sentences: inventory,
            density,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failedPages.push({ page: pageNumber, error: data?.error || `AI request failed (${res.status})` });
          continue;
        }

        // ─── 4. Verify quotes → word range → per-line canonical rects ───
        const byKey = new Map(pageSentences.map((s) => [s.sentence_key, s]));
        onProgress?.({ phase: 'matching', detail: `Página ${pageNumber}` });

        for (const selection of (data.selections ?? []) as AiSelection[]) {
          const sentence = byKey.get(selection.sentence_key);
          if (!sentence || sentence.words.length === 0) continue;

          const match = matchQuote(sentence, selection.quote);
          if (!match) {
            // Quote doesn't exist in the sentence — discard, never approximate
            console.warn('[AiHighlight] quote failed verification:', selection.sentence_key, selection.quote?.slice(0, 60));
            continue;
          }

          const rects = rectsForWordRange(sentence.words, match.startWord, match.endWord);
          if (rects.length === 0) continue;

          const color = CATEGORY_COLOR[selection.category] ?? '#93c5fd';
          const created = await createAiHighlight({
            document_id: documentId,
            workspace_id: workspaceId,
            page_index: pageNumber - 1,
            rects,
            text: match.matchedText,
            color,
            note: null,
            source: 'ai',
            ai_metadata: {
              category: selection.category,
              confidence: selection.confidence,
              origin: scannedPages.includes(pageNumber) ? 'ocr' : 'native',
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
      nativePages: Math.max(0, pageBlocks.length - scannedPages.length),
    };
  }
}

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
