/**
 * Reads the answer of the `rag-retrieve` Edge Function for the search box.
 *
 * Kept out of the component so the contract can be tested: the function returns the match type
 * inside `citation` (not at the top level), a text-only answer carries no similarity score, and
 * when the embedding provider is unavailable it says so in `degraded` instead of failing.
 */

export interface KnowledgeSearchResult {
  document_id: string;
  document_name: string;
  page_number: number;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
  match_type: string;
}

export interface KnowledgeSearchResponse {
  results: KnowledgeSearchResult[];
  /** True when the answer came from the stored text because semantic search was unavailable. */
  degraded: boolean;
}

type RawResult = Partial<KnowledgeSearchResult> & { citation?: { match_type?: string } | null };

export function parseKnowledgeSearchResponse(data: unknown): KnowledgeSearchResponse {
  const body = (data && typeof data === 'object' ? data : {}) as { results?: unknown; degraded?: unknown };
  const rows = Array.isArray(body.results) ? (body.results as RawResult[]) : [];

  const results = rows
    .filter((row) => row && typeof row.document_id === 'string')
    .map((row, position) => ({
      document_id: row.document_id as string,
      document_name: row.document_name ?? 'Unknown Document',
      page_number: Number(row.page_number) || 1,
      // A missing number must not collapse two results of one document into the same React key.
      chunk_index: Number.isInteger(row.chunk_index) ? (row.chunk_index as number) : position,
      chunk_text: row.chunk_text ?? '',
      similarity: Number(row.similarity) || 0,
      match_type: row.match_type ?? row.citation?.match_type ?? 'hybrid',
    }));

  return { results, degraded: Boolean(body.degraded) };
}

/** "73%" for a semantic match; null when there is no score to show (a plain text match scores 0). */
export function formatSimilarity(result: Pick<KnowledgeSearchResult, 'similarity' | 'match_type'>): string | null {
  if (result.match_type === 'keyword' || !(result.similarity > 0)) return null;
  return `${Math.round(Math.min(result.similarity, 1) * 100)}%`;
}
