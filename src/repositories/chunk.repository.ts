/**
 * ChunkRepository — CRUD for document text chunks.
 *
 * Chunks are created after OCR extraction and used for full-text search.
 * Future: will also store vector embeddings for semantic search.
 */

import { supabase } from '../lib/supabase';
import type { TextChunk } from '../lib/processing/TextChunker';

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
};
