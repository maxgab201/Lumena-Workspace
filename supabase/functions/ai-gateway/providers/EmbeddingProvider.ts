/**
 * EmbeddingProvider — Server-side interface for embedding generation.
 *
 * Each embedding provider (OpenAI, Google, etc.) implements this.
 * EmbeddingAction uses this interface — it never knows the concrete provider.
 */

export interface EmbeddingProviderResult {
  embeddings: number[][]
  totalTokens: number
  model: string
}

export interface EmbeddingProvider {
  /** Generate embeddings for multiple texts */
  embed(texts: string[]): Promise<EmbeddingProviderResult>

  /** Provider identifier */
  getId(): string

  /** Model identifier */
  getModelId(): string

  /** Maximum batch size */
  getMaxBatchSize(): number
}
