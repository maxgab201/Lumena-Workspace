/**
 * rag-retrieve's decision of how to answer, free of Deno/URL imports so vitest can exercise it.
 *
 * Semantic search needs the embedding provider twice: chunks must have been embedded, and the
 * query is embedded at request time. When either is missing the user must still get an answer
 * from the document's own text rather than an error.
 */

import { EmbeddingHttpError } from './embeddings.ts';

export interface RetrievedRow {
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
  keyword_rank: number;
  combined_score: number;
  page_number: number;
  chunk_type: string;
}

/**
 * What `hybrid_search` actually returns: the chunk's number comes back as `chunk_id` (text), while
 * everything downstream (citations, React keys in search results) reads `chunk_index`. Without this
 * mapping every semantic result reached the client with `chunk_index` undefined, so two results
 * from the same document shared the key "<document>-undefined".
 */
export type HybridSearchRow = Omit<RetrievedRow, 'chunk_index'> & { chunk_id?: string | number | null; chunk_index?: number };

export function normalizeHybridRows(rows: HybridSearchRow[]): RetrievedRow[] {
  return rows.map((row, position) => {
    const { chunk_id: chunkId, chunk_index: chunkIndex, ...rest } = row;
    const parsed = typeof chunkIndex === 'number' ? chunkIndex : Number(chunkId);
    // A row without a usable number still needs a distinct one: its position keeps keys unique.
    return { ...rest, chunk_index: Number.isInteger(parsed) && parsed >= 0 ? parsed : position };
  });
}

export interface RetrievalOutcome {
  rows: RetrievedRow[];
  mode: 'hybrid' | 'keyword';
  /** Why semantic search was not used; null when it was. */
  degradedReason: string | null;
}

export async function retrieveWithFallback(deps: {
  /** Embeds the query and runs the hybrid search. Throws when either step fails. */
  semantic: () => Promise<RetrievedRow[]>;
  /** True when the searched scope has at least one embedded chunk. */
  hasEmbeddings: () => Promise<boolean>;
  /** Text search over the stored chunks. Needs no provider. */
  keyword: () => Promise<RetrievedRow[]>;
  onSemanticFailure?: (error: unknown) => void;
}): Promise<RetrievalOutcome> {
  let semanticRows: RetrievedRow[];
  try {
    semanticRows = await deps.semantic();
  } catch (error) {
    deps.onSemanticFailure?.(error);
    const reason = error instanceof EmbeddingHttpError ? `embedding_${error.failure.kind}` : 'semantic_search_failed';
    return { rows: await deps.keyword(), mode: 'keyword', degradedReason: reason };
  }

  if (semanticRows.length > 0) return { rows: semanticRows, mode: 'hybrid', degradedReason: null };

  // Nothing matched. If the scope has embeddings that is a real "no match" and stays empty; if it
  // has none (indexing never finished, quota) the semantic path could not have found anything.
  if (await deps.hasEmbeddings()) return { rows: [], mode: 'hybrid', degradedReason: null };
  return { rows: await deps.keyword(), mode: 'keyword', degradedReason: 'not_indexed' };
}
