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

const BATCH_SIZE = 200; // chunks per embedding API call

/** Database row shape (snake_case from PostgreSQL) */
interface EmbeddingJobRow {
  id: string;
  document_id: string;
  workspace_id: string;
  status: string;
  total_chunks: number;
  embedded_chunks: number;
  failed_chunks: number;
  provider: string | null;
  model: string | null;
  total_tokens: number;
  cost_usd: number;
  attempt: number;
  max_attempts: number;
  error_message: string | null;
}

/** Application-level job (camelCase) */
interface EmbeddingJob {
  id: string;
  documentId: string;
  workspaceId: string;
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
  errorMessage: string | null;
}

/** Convert DB row (snake_case) to application object (camelCase) */
function rowToJob(row: EmbeddingJobRow): EmbeddingJob {
  return {
    id: row.id,
    documentId: row.document_id,
    workspaceId: row.workspace_id,
    status: row.status,
    totalChunks: row.total_chunks,
    embeddedChunks: row.embedded_chunks,
    failedChunks: row.failed_chunks,
    provider: row.provider,
    model: row.model,
    totalTokens: row.total_tokens,
    costUsd: row.cost_usd,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    errorMessage: row.error_message,
  };
}

// ─── Initialize event listener ───────────────────────────────
// Wire chunks_created → processNextJob
EventBus.on('chunks_created', () => {
  EmbeddingService.processNextJob().catch(err => {
    console.error('[EmbeddingService] Auto-process failed:', err);
  });
});

// ─── Service ─────────────────────────────────────────────────

export class EmbeddingService {
  private static workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;

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
        provider: provider?.getMetadata().id ?? null,
        model: provider?.getModelId() ?? null,
      })
      .select('id')
      .single();

    if (error || !job) {
      console.error('[EmbeddingService] Failed to create job:', error?.message);
      throw error ?? new Error('Failed to create embedding job');
    }

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
    const { data } = await supabase
      .from('embedding_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!data) throw new Error(`Job ${jobId} not found`);

    const job = rowToJob(data as EmbeddingJobRow);

    try {
      await this.processJob(job);
    } catch (error) {
      await this.handleJobFailure(job, error);
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

    return data ? rowToJob(data as EmbeddingJobRow) : null;
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
    return rowToJob(data as unknown as EmbeddingJobRow);
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

      // Check cache for each chunk (parallel hash computation)
      const hashes = await Promise.all(
        batch.map(chunk =>
          EmbeddingCache.computeHash(
            chunk.content,
            provider.getMetadata().id,
            provider.getModelId(),
            provider.getModelVersion(),
          ).then(hash => ({ chunk, hash }))
        ),
      );

      const toEmbed: { chunk: { id: string; content: string }; hash: string }[] = [];
      const cachedEmbeddings: { chunkId: string; embedding: number[] }[] = [];

      // Batch cache lookup (single query instead of N queries)
      const hashValues = hashes.map(h => h.hash);
      const { data: cacheHits } = await supabase
        .from('embedding_cache')
        .select('content_hash, embedding')
        .in('content_hash', hashValues);

      const cacheMap = new Map<string, number[]>();
      for (const hit of (cacheHits ?? [])) {
        cacheMap.set(hit.content_hash, hit.embedding as unknown as number[]);
      }

      for (const { chunk, hash } of hashes) {
        const cached = cacheMap.get(hash);
        if (cached) {
          cachedEmbeddings.push({ chunkId: chunk.id, embedding: cached });
        } else {
          toEmbed.push({ chunk, hash });
        }
      }

      // Batch save cached embeddings (single query)
      if (cachedEmbeddings.length > 0) {
        await this.batchSaveEmbeddings(cachedEmbeddings, provider);
        embeddedCount += cachedEmbeddings.length;
      }

      // Embed new texts via API
      if (toEmbed.length > 0) {
        try {
          const texts = toEmbed.map(t => t.chunk.content);
          const result = await EmbeddingRouter.embed(texts);

          // Batch save new embeddings (single query)
          const newEmbeddings: { chunkId: string; embedding: number[] }[] = [];
          const cacheEntries: { hash: string; embedding: number[] }[] = [];

          for (let k = 0; k < toEmbed.length; k++) {
            if (result.data[k]) {
              newEmbeddings.push({ chunkId: toEmbed[k].chunk.id, embedding: result.data[k] });
              cacheEntries.push({ hash: toEmbed[k].hash, embedding: result.data[k] });
            }
          }

          if (newEmbeddings.length > 0) {
            await this.batchSaveEmbeddings(newEmbeddings, provider);
          }

          // Batch save to cache
          for (const entry of cacheEntries) {
            await EmbeddingCache.set(
              entry.hash,
              entry.embedding,
              provider.getMetadata().id,
              provider.getModelId(),
              provider.getModelVersion(),
              provider.getDimensions(),
            );
          }

          embeddedCount += newEmbeddings.length;
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
        provider: provider.getMetadata().id,
        model: provider.getModelId(),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }

  /**
   * Batch save embeddings to document_chunks (single DB call).
   */
  private static async batchSaveEmbeddings(
    embeddings: { chunkId: string; embedding: number[] }[],
    provider: EmbeddingProvider,
  ): Promise<void> {
    if (embeddings.length === 0) return;

    const rows = embeddings.map(e => ({
      id: e.chunkId,
      embedding: e.embedding as unknown as string,
      embedding_provider: provider.getMetadata().id,
      embedding_model: provider.getModelId(),
      embedding_version: provider.getModelVersion(),
      embedded_at: new Date().toISOString(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase
      .from('document_chunks') as any)
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('[EmbeddingService] Batch save failed:', error.message);
    }
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
