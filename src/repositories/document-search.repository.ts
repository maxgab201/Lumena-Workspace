import { supabase } from '../lib/supabase';

export interface DocumentSearchHit {
  pageNumber: number;
  snippet: string;
  matchCount: number;
  source: 'native' | 'ocr';
}

function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * PostgREST rewrites every `*` in an ilike value to `%` and offers no escape for it, so a typed
 * `2*3` would match "2", anything, "3". `_` matches exactly one character (including a literal
 * `*`); rows the looser pattern lets through are then dropped by `containsLiteral`.
 */
export function toIlikePattern(query: string): string {
  return `%${escapeIlike(query).replace(/\*/g, '_')}%`;
}

function containsLiteral(text: string, query: string): boolean {
  return text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function buildSnippet(text: string, query: string): { snippet: string; matchCount: number } {
  const lower = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  let count = 0;
  let cursor = 0;
  let first = -1;

  while (needle && (cursor = lower.indexOf(needle, cursor)) >= 0) {
    if (first < 0) first = cursor;
    count += 1;
    cursor += Math.max(needle.length, 1);
  }

  const center = first >= 0 ? first : 0;
  const start = Math.max(0, center - 80);
  const end = Math.min(text.length, center + query.length + 140);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return {
    snippet: prefix + text.slice(start, end).replace(/\s+/g, ' ').trim() + suffix,
    matchCount: Math.max(1, count),
  };
}

/** One OCR page can match in many segments; read in pages of rows so a common word still reaches later pages. */
const OCR_BATCH_SIZE = 500;
const OCR_MAX_BATCHES = 6;

interface OcrSegmentRow {
  page_number: number;
  text: string | null;
}

/**
 * Segments that match, in page order, until `wantedPages` pages are complete. The batch that
 * crosses into page `wantedPages + 1` is the last one needed, so every wanted page is counted in
 * full. A first-batch failure is returned (the caller decides); a later one just ends the scan.
 */
async function fetchOcrSegments(
  documentId: string,
  pattern: string,
  wantedPages: number,
  keep: (text: string | null) => boolean,
): Promise<{ data: OcrSegmentRow[]; error: { message: string } | null }> {
  const rows: OcrSegmentRow[] = [];
  const pages = new Set<number>();

  for (let batch = 0; batch < OCR_MAX_BATCHES; batch += 1) {
    const from = batch * OCR_BATCH_SIZE;
    const { data, error } = await supabase
      .from('document_page_segments')
      .select('page_number,text,origin,sequence')
      .eq('document_id', documentId)
      .eq('origin', 'ocr')
      .ilike('text', pattern)
      .order('page_number', { ascending: true })
      .order('sequence', { ascending: true })
      .range(from, from + OCR_BATCH_SIZE - 1);

    if (error) {
      if (batch === 0) return { data: [], error };
      console.warn('[search] OCR scan stopped early:', error.message);
      break;
    }

    const batchRows = (data ?? []) as OcrSegmentRow[];
    for (const row of batchRows) {
      if (!keep(row.text)) continue;
      rows.push(row);
      pages.add(row.page_number);
    }
    if (batchRows.length < OCR_BATCH_SIZE || pages.size > wantedPages) break;
  }

  return { data: rows, error: null };
}

export class DocumentSearchRepository {
  static async search(documentId: string, query: string, limit = 60): Promise<DocumentSearchHit[]> {
    const trimmed = query.trim();
    if (!documentId || trimmed.length < 2) return [];

    const pattern = toIlikePattern(trimmed);
    // Only a query with `*` needs the literal re-check; for every other query the server match stands.
    const keep = trimmed.includes('*')
      ? (text: string | null) => containsLiteral(text ?? '', trimmed)
      : () => true;

    const [nativeResult, ocrResult] = await Promise.all([
      supabase
        .from('document_page_texts')
        .select('page_number,page_text')
        .eq('document_id', documentId)
        .ilike('page_text', pattern)
        .order('page_number', { ascending: true })
        .limit(limit),
      fetchOcrSegments(documentId, pattern, limit, keep),
    ]);

    const byPage = new Map<number, DocumentSearchHit>();

    if (!nativeResult.error) {
      for (const row of nativeResult.data ?? []) {
        if (!keep(row.page_text)) continue;
        const built = buildSnippet(row.page_text ?? '', trimmed);
        byPage.set(row.page_number, {
          pageNumber: row.page_number,
          snippet: built.snippet,
          matchCount: built.matchCount,
          source: 'native',
        });
      }
    }

    if (!ocrResult.error) {
      for (const row of ocrResult.data) {
        const built = buildSnippet(row.text ?? '', trimmed);
        const existing = byPage.get(row.page_number);
        if (existing) {
          existing.matchCount += built.matchCount;
          if (!existing.snippet) existing.snippet = built.snippet;
        } else {
          byPage.set(row.page_number, {
            pageNumber: row.page_number,
            snippet: built.snippet,
            matchCount: built.matchCount,
            source: 'ocr',
          });
        }
      }
    }

    if (nativeResult.error && ocrResult.error) {
      throw nativeResult.error;
    }

    return [...byPage.values()]
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .slice(0, limit);
  }
}
