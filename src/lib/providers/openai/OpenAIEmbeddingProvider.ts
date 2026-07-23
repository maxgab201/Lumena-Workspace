/**
 * OpenAIEmbeddingProvider — OpenAI text-embedding-3-small implementation.
 *
 * Uses the Edge Function ai-gateway for server-side API calls
 * (keeps API key secure on the server, enables billing/metering).
 */

import type { EmbeddingProvider } from '../interfaces/EmbeddingProvider';
import type { ProviderMetadata, ProviderResult } from '../types';

const MODEL_ID = 'text-embedding-3-small';
const MODEL_VERSION = '2024-02-01';
const DIMENSIONS = 1536;
const MAX_BATCH_SIZE = 2048;

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private metadata: ProviderMetadata = {
    id: 'openai-embedding',
    displayName: 'OpenAI text-embedding-3-small',
    version: '1.0.0',
    providerType: 'ai',
    supportsOffline: false,
    supportsGPU: false,
    supportsCPU: true,
    supportsTables: false,
    supportsImages: false,
    supportsMath: false,
    supportsHandwriting: false,
    supportsMultiColumn: false,
    supportedLanguages: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh', 'ko'],
    averageLatency: 200,
    estimatedCost: 0.02, // per 1M tokens
    qualityScore: 75,
    confidenceScore: 80,
    priority: 0, // highest priority for embeddings
    status: 'active',
    license: 'proprietary',
  };

  async initialize(): Promise<void> {
    // No initialization needed — uses Edge Function
  }

  async dispose(): Promise<void> {
    // No cleanup needed
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Quick test with a short text
      await this.embedSingle('test');
      return true;
    } catch {
      return false;
    }
  }

  getMetadata(): ProviderMetadata {
    return this.metadata;
  }

  async embed(texts: string[]): Promise<ProviderResult<number[][]>> {
    const startTime = performance.now();

    if (texts.length === 0) {
      return { data: [], confidence: 1, executionTime: 0, providerId: this.metadata.id };
    }

    if (texts.length > MAX_BATCH_SIZE) {
      throw new Error(`Batch size ${texts.length} exceeds maximum ${MAX_BATCH_SIZE}`);
    }

    // Call ai-gateway Edge Function for embedding
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action_type: 'embedding',
          model_code: MODEL_ID,
          texts,
          workspace_id: 'embedding-service', // Internal call
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding API error: ${response.status} ${error}`);
    }

    const result = await response.json();
    const executionTime = performance.now() - startTime;

    return {
      data: result.embeddings as number[][],
      confidence: 1,
      executionTime,
      providerId: this.metadata.id,
      metadata: {
        model: MODEL_ID,
        dimensions: DIMENSIONS,
        tokenCount: result.usage?.total_tokens ?? 0,
      },
    };
  }

  async embedSingle(text: string): Promise<ProviderResult<number[]>> {
    const result = await this.embed([text]);
    return {
      data: result.data[0],
      confidence: result.confidence,
      executionTime: result.executionTime,
      providerId: result.providerId,
      metadata: result.metadata,
    };
  }

  getDimensions(): number {
    return DIMENSIONS;
  }

  getMaxBatchSize(): number {
    return MAX_BATCH_SIZE;
  }

  getModelId(): string {
    return MODEL_ID;
  }

  getModelVersion(): string {
    return MODEL_VERSION;
  }
}
