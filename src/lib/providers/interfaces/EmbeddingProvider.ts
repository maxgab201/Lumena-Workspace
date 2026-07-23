/**
 * EmbeddingProvider — Interface for text embedding providers.
 *
 * Any embedding provider (OpenAI, Google, Ollama, etc.) must implement this.
 * EmbeddingService uses this interface exclusively — it never knows the concrete provider.
 */

import type { BaseProvider } from './BaseProvider';
import type { ProviderResult } from '../types';

export interface EmbeddingProvider extends BaseProvider {
  /**
   * Generate embeddings for multiple texts in a single batch call.
   * @param texts - Array of text strings to embed
   * @returns Array of embedding vectors (same order as input)
   */
  embed(texts: string[]): Promise<ProviderResult<number[][]>>;

  /**
   * Generate embedding for a single text.
   * Convenience method — equivalent to embed([text])[0].
   */
  embedSingle(text: string): Promise<ProviderResult<number[]>>;

  /**
   * Get the number of dimensions for this model's embeddings.
   */
  getDimensions(): number;

  /**
   * Maximum number of texts per batch call.
   */
  getMaxBatchSize(): number;

  /**
   * Model identifier (e.g., 'text-embedding-3-small').
   */
  getModelId(): string;

  /**
   * Model version string (e.g., '2024-02-01').
   */
  getModelVersion(): string;
}
