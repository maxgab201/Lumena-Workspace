/**
 * EmbeddingCache — Cross-document cache for embedding vectors.
 *
 * Cache key: SHA-256(provider + model + version + normalized_text)
 * Cache table: embedding_cache (separate from document_chunks)
 * Reconstructable: can be rebuilt from document_chunks if lost.
 */

import { supabase } from '../../supabase';

function normalizeForHash(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface CacheEntry {
  embedding: number[];
  provider: string;
  model: string;
  version: string;
}

export class EmbeddingCache {
  /**
   * Compute composite hash: SHA-256(provider:model:version:normalized_text)
   */
  static async computeHash(
    text: string,
    provider: string,
    model: string,
    version: string,
  ): Promise<string> {
    const normalized = normalizeForHash(text);
    return sha256(`${provider}:${model}:${version}:${normalized}`);
  }

  /**
   * Look up a cached embedding by content hash.
   * Returns null on cache miss.
   */
  static async get(contentHash: string): Promise<CacheEntry | null> {
    const { data, error } = await supabase
      .from('embedding_cache')
      .select('embedding, provider, model, model_version, use_count')
      .eq('content_hash', contentHash)
      .single();

    if (error || !data) return null;

    // Update usage stats (fire-and-forget)
    const currentCount = (data as Record<string, unknown>).use_count as number ?? 0;
    supabase
      .from('embedding_cache')
      .update({
        last_used_at: new Date().toISOString(),
        use_count: currentCount + 1,
      })
      .eq('content_hash', contentHash)
      .then(() => {}); // intentionally ignored

    return {
      embedding: data.embedding as unknown as number[],
      provider: data.provider,
      model: data.model,
      version: data.model_version,
    };
  }

  /**
   * Store an embedding in the cache.
   */
  static async set(
    contentHash: string,
    embedding: number[],
    provider: string,
    model: string,
    version: string,
    dimensions: number,
  ): Promise<void> {
    const { error } = await supabase
      .from('embedding_cache')
      .upsert({
        content_hash: contentHash,
        embedding: embedding as unknown as string,
        provider,
        model,
        model_version: version,
        dimensions,
        last_used_at: new Date().toISOString(),
      }, { onConflict: 'content_hash' });

    if (error) {
      console.error('[EmbeddingCache] Failed to store:', error.message);
    }
  }

  /**
   * Get cache hit rate metrics.
   * Uses COUNT aggregate to avoid loading entire table into memory.
   */
  static async getStats(): Promise<{ totalEntries: number; avgUseCount: number }> {
    const { count } = await supabase
      .from('embedding_cache')
      .select('id', { count: 'exact', head: true });

    const totalEntries = count ?? 0;
    if (totalEntries === 0) return { totalEntries: 0, avgUseCount: 0 };

    // Get average use_count via a small sample (not full table scan)
    const { data } = await supabase
      .from('embedding_cache')
      .select('use_count')
      .limit(100);

    const avgUseCount = data && data.length > 0
      ? data.reduce((sum, row) => sum + ((row as Record<string, unknown>).use_count as number || 0), 0) / data.length
      : 0;

    return { totalEntries, avgUseCount };
  }
}
