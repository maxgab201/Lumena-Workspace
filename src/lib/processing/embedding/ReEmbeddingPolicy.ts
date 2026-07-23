/**
 * ReEmbeddingPolicy — Manages embedding lifecycle and re-generation.
 *
 * When a provider/model changes, embeddings can be marked obsolete
 * and re-generated progressively in background.
 */

import { supabase } from '../../supabase';
import { EmbeddingService } from './EmbeddingService';

export class ReEmbeddingPolicy {
  /**
   * Mark embeddings as obsolete by clearing the vector.
   * Chunks become pending and will be re-processed by EmbeddingService.
   */
  static async markObsolete(
    provider: string,
    model: string,
    version: string,
  ): Promise<{ affected: number }> {
    const { count } = await supabase
      .from('document_chunks')
      .update({
        embedding: null,
        embedded_at: null,
      })
      .eq('embedding_provider', provider)
      .eq('embedding_model', model)
      .eq('embedding_version', version)
      .not('embedding', 'is', null);

    return { affected: count ?? 0 };
  }

  /**
   * Re-embed obsolete chunks progressively.
   * Creates embedding jobs for affected documents.
   */
  static async reEmbedBatch(
    batchSize: number = 100,
  ): Promise<number> {
    // Find documents with unembedded chunks
    const { data: pendingDocs } = await supabase
      .from('document_chunks')
      .select('document_id')
      .is('embedding', null)
      .not('content', 'is', null)
      .limit(batchSize);

    if (!pendingDocs || pendingDocs.length === 0) return 0;

    // Group by document
    const docIds = [...new Set(pendingDocs.map(d => d.document_id))];

    for (const docId of docIds) {
      // Get document's workspace_id
      const { data: doc } = await supabase
        .from('documents')
        .select('workspace_id')
        .eq('id', docId)
        .single();

      if (!doc) continue;

      // Count pending chunks for this document
      const { count } = await supabase
        .from('document_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', docId)
        .is('embedding', null);

      if (count && count > 0) {
        await EmbeddingService.createJob(docId, doc.workspace_id, count);
      }
    }

    return pendingDocs.length;
  }

  /**
   * Check if a document needs re-embedding due to model version change.
   */
  static async needsReEmbedding(
    documentId: string,
    currentVersion: string,
  ): Promise<boolean> {
    const { count } = await supabase
      .from('document_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .neq('embedding_version', currentVersion)
      .not('embedding', 'is', null);

    return (count ?? 0) > 0;
  }
}
