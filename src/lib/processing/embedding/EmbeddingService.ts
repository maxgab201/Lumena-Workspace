/**
 * EmbeddingService — Orchestrates embedding generation via jobs.
 *
 * Event-driven: triggered by 'chunks_created' events.
 * No polling. Jobs persist in DB and survive restarts.
 * Supports distributed execution via locking (claim_embedding_job RPC).
 */

import { supabase } from '../../supabase';
import { EmbeddingRouter } from '../../providers/EmbeddingRouter';
import { EmbeddingCache } from './EmbeddingCache';
import { EventBus } from '../EventBus';
import type { EmbeddingProvider } from '../../providers/interfaces/EmbeddingProvider';

const BATCH_SIZE = 100; // chunks per embedding API call

interface EmbeddingJob {
  id: string;
  documentId: string;
  status: string;
  totalChunks: number;
  embeddedChunks: number;
  failedChunks: number;
  provider: string | null;
  model: string | null;
  totalTokens: number;
  costUsd: number;
  attempt: number;
  maxAttempts: number;
}

export class EmbeddingService {
  private static workerId = `worker-${Math.random().toString(36).slice(2, 8)}`;

  /**
   * Create an embedding job for a document.
   * Called after TextChunker produces new chunks.
   */
  static async createJob(
    documentId: string,
    workspaceId: string,
    chunkCount: number,
  ): Promise<string> {
    // Check if there's already a pending/processing job for this document
    const { data: existing } = await supabase
      .from('embedding_jobs')
      .select('id, status')
      .eq('document_id', documentId)
      .in('status', ['pending', 'processing'])
      .limit(1)
      .single();

    if (existing) {
      // Update existing job with new chunk count
      await supabase
        .from('embedding_jobs')
        .update({ total_chunks: chunkCount, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      return existing.id;
    }

    // Create new job
    const provider = EmbeddingRouter.getActiveProvider();
    const { data: job, error } = await supabase
      .from('embedding_jobs')
      .insert({
        document_id: documentId,
        workspace_id: workspaceId,
        status: 'pending',
        total_chunks: chunkCount,
        provider: provider?.getModelId() ?? null,
        model: provider?.getModelId() ?? null,
      })
      .select('id')
      .single();

    if (error || !job) {
      console.error('[EmbeddingService] Failed to create job:', error?.message);
      throw error ?? new Error('Failed to create embedding job');
    }

    // Trigger processing via EventBus
    EventBus.emit('chunks_created', { documentId, chunkCount });

    return job.id;
  }

  /**
   * Process the next pending job.
   * Called on event trigger, not polling.
   */
  static async processNextJob(): Promise<void> {
    const job = await this.claimJob();
    if (!job) return;

    try {
      await this.processJob(job);
    } catch (error) {
      console.error(`[EmbeddingService] Job ${job.id} failed:`, error);
      await this.handleJobFailure(job, error);
    }
  }

  /**
   * Process a specific job by ID.
   */
  static async processJobById(jobId: string): Promise<void> {
    const { data: job } = await supabase
      .from('embedding_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) throw new Error(`Job ${jobId} not found`);

    try {
      await this.processJob(job as unknown as EmbeddingJob);
    } catch (error) {
      await this.handleJobFailure(job as unknown as EmbeddingJob, error);
    }
  }

  /**
   * Get the status of a job.
   */
  static async getJobStatus(jobId: string): Promise<EmbeddingJob | null> {
    const { data } = await supabase
      .from('embedding_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    return data as unknown as EmbeddingJob | null;
  }

  /**
   * Check if a document has pending embedding work.
   */
  static async hasPendingWork(documentId: string): Promise<boolean> {
    const { count } = await supabase
      .from('embedding_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .in('status', ['pending', 'processing']);

    return (count ?? 0) > 0;
  }

  // ─── Private ─────────────────────────────────────────────

  private static async claimJob(): Promise<EmbeddingJob | null> {
    const { data, error } = await supabase.rpc('claim_embedding_job', {
      p_worker_id: this.workerId,
    });

    if (error || !data) return null;
    return data as unknown as EmbeddingJob;
  }

  private static async processJob(job: EmbeddingJob): Promise<void> {
    const provider = EmbeddingRouter.getActiveProvider();
    if (!provider) throw new Error('No embedding provider available');

    let embeddedCount = 0;
    let failedCount = 0;
    let totalTokens = 0;

    // Get unembedded chunks for this document
    const chunks = await this.getUnembeddedChunks(job.documentId);

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      // Check cache for each chunk
      const toEmbed: { index: number; text: string; hash: string }[] = [];
      const cachedResults: { index: number; embedding: number[] }[] = [];

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const hash = await EmbeddingCache.computeHash(
          chunk.content,
          provider.getModelId(),
          provider.getModelId(),
          provider.getModelVersion(),
        );

        const cached = await EmbeddingCache.get(hash);
        if (cached) {
          cachedResults.push({ index: i + j, embedding: cached.embedding });
        } else {
          toEmbed.push({ index: i + j, text: chunk.content, hash });
        }
      }

      // Apply cached embeddings
      for (const cached of cachedResults) {
        const chunk = chunks[cached.index];
        if (chunk) {
          await this.saveEmbedding(chunk.id, cached.embedding, provider);
          embeddedCount++;
        }
      }

      // Embed new texts
      if (toEmbed.length > 0) {
        try {
          const texts = toEmbed.map(t => t.text);
          const result = await EmbeddingRouter.embed(texts);

          for (let k = 0; k < toEmbed.length; k++) {
            const chunk = chunks[toEmbed[k].index];
            if (chunk && result.data[k]) {
              await this.saveEmbedding(chunk.id, result.data[k], provider);

              // Store in cache
              await EmbeddingCache.set(
                toEmbed[k].hash,
                result.data[k],
                provider.getModelId(),
                provider.getModelId(),
                provider.getModelVersion(),
                provider.getDimensions(),
              );

              embeddedCount++;
            }
          }

          totalTokens += (result.metadata?.tokenCount as number) ?? 0;
        } catch (error) {
          console.error(`[EmbeddingService] Batch embedding failed:`, error);
          failedCount += toEmbed.length;
        }
      }
    }

    // Update job completion
    await supabase
      .from('embedding_jobs')
      .update({
        status: 'completed',
        embedded_chunks: embeddedCount,
        failed_chunks: failedCount,
        total_tokens: totalTokens,
        provider: provider.getModelId(),
        model: provider.getModelId(),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }

  private static async saveEmbedding(
    chunkId: string,
    embedding: number[],
    provider: EmbeddingProvider,
  ): Promise<void> {
    await supabase
      .from('document_chunks')
      .update({
        embedding: embedding as unknown as string,
        embedding_provider: provider.getModelId(),
        embedding_model: provider.getModelId(),
        embedding_version: provider.getModelVersion(),
        embedded_at: new Date().toISOString(),
      })
      .eq('id', chunkId);
  }

  private static async getUnembeddedChunks(documentId: string) {
    const { data } = await supabase
      .from('document_chunks')
      .select('id, content')
      .eq('document_id', documentId)
      .is('embedding', null)
      .not('content', 'is', null)
      .order('page_number', { ascending: true })
      .order('start_offset', { ascending: true });

    return data ?? [];
  }

  private static async handleJobFailure(job: EmbeddingJob, error: unknown): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (job.attempt < job.maxAttempts) {
      // Retry with exponential backoff
      const backoffMinutes = Math.pow(2, job.attempt) * 5;
      const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await supabase
        .from('embedding_jobs')
        .update({
          status: 'pending',
          locked_by: null,
          locked_at: null,
          error_message: errorMsg,
          next_retry_at: nextRetry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    } else {
      // Max attempts reached
      await supabase
        .from('embedding_jobs')
        .update({
          status: 'failed',
          locked_by: null,
          locked_at: null,
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  }
}
