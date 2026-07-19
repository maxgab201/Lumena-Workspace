import type { AIProvider } from './providers/Provider.ts'
import { GeminiProvider } from './providers/GeminiProvider.ts'
import { OpenAIProvider } from './providers/OpenAIProvider.ts'

export class ProviderRouter {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    // Attempt to register providers. If API keys are missing, they may throw during initialization
    // or when generating. We catch initialization errors so the router can still function with available providers.
    try {
      this.providers.set('google', new GeminiProvider());
    } catch (e) {
      console.warn('Failed to initialize GeminiProvider:', e);
    }

    try {
      this.providers.set('openai', new OpenAIProvider());
    } catch (e) {
      console.warn('Failed to initialize OpenAIProvider:', e);
    }
  }

  /**
   * Routes the request through a fallback chain of models.
   * 
   * @param fallbackChain Array of models to try in sequence (e.g. ['gemini-1.5-pro', 'gemini-1.5-flash'])
   * @param prompt The user's prompt
   * @param executeAction A callback that receives the current model info. The callback should:
   *   1. Fetch the model pricing and verify it is active
   *   2. Estimate and Reserve credits for the model
   *   3. Invoke the provider's generate method
   *   4. Settle credits
   *   If it throws an error (e.g. rate limit, provider error), the router will catch it and try the next model.
   *   If insufficient credits, it should throw an error that aborts the fallback (since all models cost money).
   */
  async routeWithFallback<T>(
    fallbackChain: string[],
    prompt: string,
    executeAction: (modelCode: string, provider: AIProvider) => Promise<T>
  ): Promise<{ result: T, usedModel: string }> {
    const errors: Error[] = [];

    for (const modelCode of fallbackChain) {
      // Determine provider based on model code prefix, or from DB (executeAction will handle DB checks)
      // For simplicity in routing, we map known prefixes to provider IDs.
      let providerId = 'google';
      if (modelCode.startsWith('gpt-')) {
        providerId = 'openai';
      }

      const provider = this.providers.get(providerId);
      if (!provider) {
        errors.push(new Error(`Provider '${providerId}' not available for model '${modelCode}'.`));
        continue;
      }

      try {
        console.log(`Attempting model: ${modelCode} via provider: ${providerId}`);
        const result = await executeAction(modelCode, provider);
        return { result, usedModel: modelCode };
      } catch (error: any) {
        console.warn(`Attempt with ${modelCode} failed:`, error.message);
        errors.push(error);
        
        // If it's a 402 Insufficient Credits, we abort immediately. No point falling back.
        if (error.status === 402 || error.message.includes('Insufficient credits')) {
          throw error;
        }
      }
    }

    throw new Error(`All models in fallback chain failed. Errors: ${errors.map(e => e.message).join(' | ')}`);
  }
}
