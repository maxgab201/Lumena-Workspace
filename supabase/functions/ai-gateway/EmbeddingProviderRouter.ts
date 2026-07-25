/**
 * EmbeddingProviderRouter — Server-side routing for embedding providers.
 *
 * Follows the same pattern as ProviderRouter for chat:
 * tries providers in priority order, falls back on failure.
 */

import type { EmbeddingProvider, EmbeddingProviderResult } from "./providers/EmbeddingProvider.ts"
import { OpenAIEmbeddingProvider } from "./providers/OpenAIEmbeddingProvider.ts"

// Provider fallback chain (configurable)
const FALLBACK_CHAIN = ["openai"]
// Future: "google", "cohere", etc.

export class EmbeddingProviderRouter {
  private providers: Map<string, EmbeddingProvider> = new Map()

  constructor() {
    // Register available providers
    try {
      this.providers.set("openai", new OpenAIEmbeddingProvider())
    } catch (e) {
      console.warn("Failed to initialize OpenAIEmbeddingProvider:", e)
    }
    // Future: register more providers here
  }

  /**
   * Embed texts using the best available provider.
   * Falls back to next provider on failure.
   */
  async embed(
    texts: string[],
    preferredProvider?: string,
  ): Promise<EmbeddingProviderResult & { providerId: string }> {
    const chain = preferredProvider
      ? [preferredProvider, ...FALLBACK_CHAIN.filter(p => p !== preferredProvider)]
      : FALLBACK_CHAIN

    const errors: Error[] = []

    for (const providerId of chain) {
      const provider = this.providers.get(providerId)
      if (!provider) continue

      try {
        const result = await provider.embed(texts)
        return { ...result, providerId }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        console.warn(`[EmbeddingProviderRouter] ${providerId} failed:`, err.message)
        errors.push(err)
      }
    }

    throw new Error(
      `All embedding providers failed: ${errors.map(e => e.message).join(" | ")}`,
    )
  }

  /**
   * Get the active embedding provider.
   */
  getActiveProvider(): EmbeddingProvider | null {
    for (const id of FALLBACK_CHAIN) {
      if (this.providers.has(id)) return this.providers.get(id)!
    }
    return null
  }
}
