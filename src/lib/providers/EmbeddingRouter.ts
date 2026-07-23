/**
 * EmbeddingRouter — Routes embedding requests to the best available provider.
 *
 * Follows the same pattern as AI Gateway's ProviderRouter:
 * tries providers in priority order, falls back on failure.
 *
 * EmbeddingService never imports concrete providers — only this router.
 */

import { ProviderRegistry } from './ProviderRegistry';
import type { EmbeddingProvider } from './interfaces/EmbeddingProvider';
import type { ProviderResult } from './types';
import { providerConfig } from './provider.config';

export class EmbeddingRouter {
  /**
   * Embed multiple texts using the best available provider.
   * Falls back to next provider on failure.
   */
  static async embed(
    texts: string[],
    options?: { preferredProvider?: string },
  ): Promise<ProviderResult<number[][]>> {
    const fallbackChain = options?.preferredProvider
      ? [options.preferredProvider, ...providerConfig.fallbacks.embedding]
      : providerConfig.fallbacks.embedding;

    const errors: Error[] = [];

    for (const providerId of fallbackChain) {
      if (!ProviderRegistry.isEnabled(providerId)) continue;

      const provider = ProviderRegistry.getProvider<EmbeddingProvider>(providerId);
      if (!provider) continue;

      try {
        const isHealthy = await provider.healthCheck();
        if (!isHealthy) continue;

        return await provider.embed(texts);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.warn(`[EmbeddingRouter] Provider ${providerId} failed:`, err.message);
        errors.push(err);
      }
    }

    throw new Error(
      `All embedding providers failed. Errors: ${errors.map(e => e.message).join(' | ')}`,
    );
  }

  /**
   * Embed a single text.
   */
  static async embedSingle(
    text: string,
    options?: { preferredProvider?: string },
  ): Promise<ProviderResult<number[]>> {
    const result = await this.embed([text], options);
    return {
      data: result.data[0],
      confidence: result.confidence,
      executionTime: result.executionTime,
      providerId: result.providerId,
      metadata: result.metadata,
    };
  }

  /**
   * Get the current active embedding provider.
   */
  static getActiveProvider(): EmbeddingProvider | null {
    for (const providerId of providerConfig.fallbacks.embedding) {
      if (ProviderRegistry.isEnabled(providerId)) {
        return ProviderRegistry.getProvider<EmbeddingProvider>(providerId) ?? null;
      }
    }
    return null;
  }
}
