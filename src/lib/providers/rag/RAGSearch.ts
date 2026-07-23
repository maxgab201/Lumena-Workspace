/**
 * RAGSearch — Hybrid search combining FTS and vector similarity.
 *
 * Uses configurable strategy (balanced, semantic_first, lexical_first, etc.)
 * Falls back gracefully: vector unavailable → FTS only.
 */

import { ChunkRepository } from '../../../repositories/chunk.repository';
import { EmbeddingRouter } from '../../providers/EmbeddingRouter';
import type { HybridStrategy } from '../../processing/embedding/HybridSearchConfig';

export interface SearchResult {
  chunkId: string;
  content: string;
  pageNumber: number;
  similarity: number;
}

export class RAGSearch {
  /**
   * Hybrid search: combines FTS + vector similarity.
   *
   * Strategy controls the balance:
   * - balanced: 30% FTS + 70% vector (default)
   * - semantic_first: 10% FTS + 90% vector
   * - lexical_first: 70% FTS + 30% vector
   * - semantic_only: 100% vector
   * - lexical_only: 100% FTS (no embeddings needed)
   *
   * Graceful degradation: if vector search fails or embeddings don't exist,
   * automatically falls back to FTS.
   */
  static async searchRelevantChunks(
    query: string,
    documentId: string,
    topK: number = 5,
    strategy: HybridStrategy = 'balanced',
  ): Promise<SearchResult[]> {
    if (!query.trim() || !documentId) return [];

    try {
      // Generate query embedding (if available)
      let queryEmbedding: number[] | null = null;
      try {
        const result = await EmbeddingRouter.embedSingle(query);
        queryEmbedding = result.data;
      } catch {
        // Embedding unavailable — will fall back to FTS via strategy
        console.warn('[RAGSearch] Embedding unavailable, falling back to FTS');
      }

      // Hybrid search
      const results = await ChunkRepository.hybridSearch(
        documentId,
        query,
        queryEmbedding,
        topK,
        strategy,
      );

      return results.map(r => ({
        chunkId: r.id,
        content: r.content,
        pageNumber: r.page_number,
        similarity: r.score,
      }));
    } catch (error) {
      console.error('[RAGSearch] Search failed:', error);

      // Fallback: try pure FTS
      try {
        const ftsResults = await ChunkRepository.searchChunks(documentId, query, topK);
        return ftsResults.map(r => ({
          chunkId: r.id,
          content: r.content,
          pageNumber: r.page_number,
          similarity: 0.5,
        }));
      } catch {
        return [];
      }
    }
  }
}
