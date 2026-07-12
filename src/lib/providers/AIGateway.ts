import { ProviderFallback } from './ProviderFallback';
import type { AIData } from './interfaces/AIProvider';
import type { ProviderResult } from './types';
import { providerConfig } from './provider.config';

/**
 * AIGateway orchestrates calls to text generation models (LLMs).
 * It uses the ProviderFallback system to ensure resilience and model routing.
 */
export class AIGateway {
  /**
   * Generates a text response based on a prompt and optional context.
   * Routes through the fallback sequence defined for 'ai' capabilities.
   * 
   * @param prompt The prompt to send to the LLM.
   * @param context Additional contextual data.
   * @returns A promise resolving to the generated AIData.
   */
  static async generate(prompt: string, context?: any): Promise<ProviderResult<AIData>> {
    try {
      const providerIds = providerConfig.fallbacks.ai || [];
      const result = await ProviderFallback.executeWithFallback<any, ProviderResult<AIData>>(
        providerIds,
        async (provider) => {
          // Type guard to ensure the provider is an AIProvider
          if (provider.getMetadata().providerType !== 'ai') {
            throw new Error(`Provider ${provider.getMetadata().id} does not support 'ai' generation.`);
          }
          
          // Invoke the specific generate method on the AI provider
          return provider.generate(prompt, context);
        }
      );
      return result;
    } catch (error) {
      console.error('[AIGateway] All AI providers failed:', error);
      throw error;
    }
  }
}
