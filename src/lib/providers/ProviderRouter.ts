import { ProviderRegistry } from './ProviderRegistry';
import type { BaseProvider } from './interfaces/BaseProvider';
import type { DocumentProfile, ProviderType } from './types';

export class ProviderRouter {
  /**
   * Selects the best provider for a given task and document profile.
   * Scoring factors:
   * - Hardware constraints (GPU vs CPU)
   * - Document content (math, tables, images, handwriting)
   * - Language support
   * - Latency, cost, and quality
   */
  static getBestProvider<T extends BaseProvider>(
    type: ProviderType,
    profile: DocumentProfile
  ): T | null {
    const availableProviders = ProviderRegistry.listByCapability(type);

    if (availableProviders.length === 0) {
      return null;
    }

    // Sort providers by calculated score (highest score first)
    const scoredProviders = availableProviders.map(provider => {
      const score = this.calculateScore(provider, profile);
      return { provider, score };
    }).sort((a, b) => b.score - a.score);

    return scoredProviders[0].provider as T;
  }

  /**
   * Calculate a dynamic score for a provider given the document profile.
   */
  private static calculateScore(provider: BaseProvider, profile: DocumentProfile): number {
    const meta = provider.getMetadata();
    let score = 1000; // Base score

    // Feature constraints (strong penalties if not supported)
    if (profile.hasMath && !meta.supportsMath) score -= 500;
    if (profile.hasTables && !meta.supportsTables) score -= 300;
    if (profile.hasImages && !meta.supportsImages) score -= 200;
    if (profile.hasHandwriting && !meta.supportsHandwriting) score -= 400;
    if (profile.hasMultiColumn && !meta.supportsMultiColumn) score -= 200;

    // Language constraint
    if (profile.primaryLanguage && !meta.supportedLanguages.includes(profile.primaryLanguage) && meta.supportedLanguages.length > 0) {
      score -= 800; // Heavy penalty if language is unsupported
    }

    // Quality metrics (0-100 scales)
    score += meta.qualityScore * 2;
    score += meta.confidenceScore;

    // Tie-breaker properties
    score -= meta.priority * 10; // Lower priority number is better
    score -= (meta.averageLatency / 100); // Slight penalty for higher latency
    score -= (meta.estimatedCost * 10); // Slight penalty for higher cost

    return score;
  }
}
