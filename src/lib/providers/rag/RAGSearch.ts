/**
 * RAGSearch - Text search using PostgreSQL full-text search
 *
 * Uses tsvector/tsquery for efficient text matching.
 * Future: Will use vector embeddings for semantic similarity search.
 */

import { ChunkRepository } from '../../../repositories/chunk.repository';

export interface SearchResult {
  chunkId: string;
  content: string;
  pageNumber: number;
  similarity: number;
}

export class RAGSearch {
  /**
   * Search for relevant text chunks using PostgreSQL full-text search.
   *
   * Uses plainto_tsquery which handles natural language queries:
   * - Stemming (running → run)
   * - Stop word removal (the, a, is)
   * - Language-aware tokenization
   *
   * NOTE: This is text matching, not semantic similarity.
   * For semantic search, vector embeddings are needed (Issue #18).
   */
  static async searchRelevantChunks(
    query: string,
    documentId: string,
    topK: number = 5
  ): Promise<SearchResult[]> {
    if (!query.trim() || !documentId) return [];

    try {
      const results = await ChunkRepository.searchChunks(documentId, query, topK);

      return results.map(r => ({
        chunkId: r.id,
        content: r.content,
        pageNumber: r.page_number,
        similarity: 1.0 - (r.rank * 0.1), // Rough relevance score based on rank
      }));
    } catch (error) {
      console.error('[RAGSearch] Search failed:', error);
      return [];
    }
  }
}
