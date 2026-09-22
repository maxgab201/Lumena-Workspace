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

export class DocumentSearchRepository {
  static async search(documentId: string, query: string, limit = 60): Promise<DocumentSearchHit[]> {
    const trimmed = query.trim();
    if (!documentId || trimmed.length < 2) return [];

    const pattern = `%${escapeIlike(trimmed)}%`;

    const [nativeResult, ocrResult] = await Promise.all([
      supabase
        .from('document_page_texts')
        .select('page_number,page_text')
        .eq('document_id', documentId)
        .ilike('page_text', pattern)
        .order('page_number', { ascending: true })
        .limit(limit),
      supabase
        .from('document_page_segments')
        .select('page_number,text,origin,sequence')
        .eq('document_id', documentId)
        .eq('origin', 'ocr')
        .ilike('text', pattern)
        .order('page_number', { ascending: true })
        .order('sequence', { ascending: true })
        .limit(limit * 3),
    ]);

    const byPage = new Map<number, DocumentSearchHit>();

    if (!nativeResult.error) {
      for (const row of nativeResult.data ?? []) {
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
      for (const row of ocrResult.data ?? []) {
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
