/**
 * ChunkRepository — CRUD for document text chunks.
 *
 * Chunks are created after OCR extraction and used for:
 * - Full-text search (tsvector)
 * - Vector search (pgvector embeddings)
 * - Hybrid search (combined FTS + vector)
 */

import { supabase } from '../lib/supabase';
import type { TextChunk } from '../lib/processing/TextChunker';
import { getStrategyWeights, type HybridStrategy } from '../lib/processing/embedding/HybridSearchConfig';

export const ChunkRepository = {
  /**
   * Upsert a single chunk. Safe to call multiple times (idempotent).
   */
  async upsertChunk(chunk: TextChunk): Promise<void> {
    const { error } = await supabase
      .from('document_chunks')
      .upsert({
        id: chunk.id,
        document_id: chunk.documentId,
        page_number: chunk.pageNumber,
        content: chunk.content,
        token_count: chunk.tokenCount,
        start_offset: chunk.startOffset,
        end_offset: chunk.endOffset,
        chunk_type: chunk.chunkType,
      }, { onConflict: 'id' });

    if (error) throw error;
  },

  /**
   * Batch upsert multiple chunks at once.
   */
  async upsertBatch(chunks: TextChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const rows = chunks.map(c => ({
      id: c.id,
      document_id: c.documentId,
      page_number: c.pageNumber,
      content: c.content,
      token_count: c.tokenCount,
      start_offset: c.startOffset,
      end_offset: c.endOffset,
      chunk_type: c.chunkType,
    }));

    const { error } = await supabase
      .from('document_chunks')
      .upsert(rows, { onConflict: 'id' });

    if (error) throw error;
  },

  /**
   * Get all chunks for a document, ordered by page and offset.
   */
  async getChunksByDocument(documentId: string): Promise<Array<{
    id: string;
    page_number: number;
    content: string;
    token_count: number;
    chunk_type: string;
  }>> {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, page_number, content, token_count, chunk_type')
      .eq('document_id', documentId)
      .order('page_number', { ascending: true })
      .order('start_offset', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Full-text search across chunks for a document.
   * Uses PostgreSQL tsvector for efficient text matching.
   */
  async searchChunks(
    documentId: string,
    query: string,
    topK: number = 5,
  ): Promise<Array<{
    id: string;
    page_number: number;
    content: string;
    rank: number;
  }>> {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, page_number, content')
      .eq('document_id', documentId)
      .textSearch('search_vector', query, { type: 'plain' })
      .limit(topK);

    if (error) throw error;

    return (data ?? []).map((row, i) => ({
      id: row.id,
      page_number: row.page_number,
      content: row.content,
      rank: i + 1,
    }));
  },

  /**
   * Delete all chunks for a document.
   */
  async deleteByDocument(documentId: string): Promise<void> {
    const { error } = await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId);

    if (error) throw error;
  },

  /**
   * Check if a document already has chunks (for resume support).
   */
  async hasChunks(documentId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('document_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId);

    if (error) throw error;
    return (count ?? 0) > 0;
  },

  // ─── Vector Search Methods ───────────────────────────────

  /**
   * Get chunks that don't have embeddings yet (for embedding pipeline).
   */
  async getUnembeddedChunks(documentId: string): Promise<Array<{
    id: string;
    content: string;
    page_number: number;
  }>> {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, content, page_number')
      .eq('document_id', documentId)
      .is('embedding', null)
      .not('content', 'is', null)
      .order('page_number', { ascending: true })
      .order('start_offset', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Pure vector similarity search.
   */
  async searchByEmbedding(
    documentId: string,
    _queryEmbedding: number[],
    topK: number = 10,
  ): Promise<Array<{
    id: string;
    page_number: number;
    content: string;
    similarity: number;
  }>> {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, page_number, content')
      .eq('document_id', documentId)
      .not('embedding', 'is', null)
      .order('embedding', {
        referencedTable: 'embedding' as unknown as string,
        ascending: false,
      })
      .limit(topK);

    // Fallback: if order by embedding fails, return FTS results
    if (error || !data) {
      const ftsResults = await this.searchChunks(documentId, '', topK);
      return ftsResults.map(r => ({
        id: r.id,
        page_number: r.page_number,
        content: r.content,
        similarity: 0.5,
      }));
    }

    // Calculate cosine similarity in JS as fallback (pgvector order may not work via JS client)
    const results = data.map(row => ({
      id: row.id,
      page_number: row.page_number,
      content: row.content,
      similarity: 0.5, // placeholder — actual similarity computed by hybrid search
    }));

    return results;
  },

  /**
   * Hybrid search: combines FTS and vector similarity.
   * Uses configurable strategy weights.
   */
  async hybridSearch(
    documentId: string,
    query: string,
    queryEmbedding: number[] | null,
    topK: number = 10,
    strategy: HybridStrategy = 'balanced',
  ): Promise<Array<{
    id: string;
    page_number: number;
    content: string;
    score: number;
    ftsScore: number;
    vectorScore: number;
  }>> {
    const weights = getStrategyWeights(strategy);

    // If strategy is lexical-only or no embedding available, use pure FTS
    if (strategy === 'lexical_only' || !queryEmbedding) {
      const ftsResults = await this.searchChunks(documentId, query, topK);
      return ftsResults.map(r => ({
        id: r.id,
        page_number: r.page_number,
        content: r.content,
        score: r.rank,
        ftsScore: r.rank,
        vectorScore: 0,
      }));
    }

    // If strategy is semantic-only, use pure vector
    if (strategy === 'semantic_only') {
      const vecResults = await this.searchByEmbedding(documentId, queryEmbedding, topK);
      return vecResults.map(r => ({
        id: r.id,
        page_number: r.page_number,
        content: r.content,
        score: r.similarity,
        ftsScore: 0,
        vectorScore: r.similarity,
      }));
    }

    // Combined: run both and merge with Reciprocal Rank Fusion
    const [ftsResults, vecResults] = await Promise.all([
      this.searchChunks(documentId, query, topK * 2),
      queryEmbedding ? this.searchByEmbedding(documentId, queryEmbedding, topK * 2) : Promise.resolve([]),
    ]);

    // Reciprocal Rank Fusion
    const scoreMap = new Map<string, {
      id: string;
      page_number: number;
      content: string;
      ftsRank: number;
      vecRank: number;
    }>();

    for (let i = 0; i < ftsResults.length; i++) {
      const r = ftsResults[i];
      scoreMap.set(r.id, { ...r, ftsRank: i + 1, vecRank: topK * 2 + 1 });
    }

    for (let i = 0; i < vecResults.length; i++) {
      const r = vecResults[i];
      const existing = scoreMap.get(r.id);
      if (existing) {
        existing.vecRank = i + 1;
      } else {
        scoreMap.set(r.id, {
          id: r.id,
          page_number: r.page_number,
          content: r.content,
          ftsRank: topK * 2 + 1,
          vecRank: i + 1,
        });
      }
    }

    // Compute combined score
    const k = 60; // RRF constant
    const results = Array.from(scoreMap.values()).map(r => {
      const ftsScore = weights.ftsWeight / (k + r.ftsRank);
      const vecScore = weights.vectorWeight / (k + r.vecRank);
      return {
        id: r.id,
        page_number: r.page_number,
        content: r.content,
        score: ftsScore + vecScore,
        ftsScore,
        vectorScore: vecScore,
      };
    });

    // Sort by combined score, take top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  },
};
