import { ProviderRegistry } from './ProviderRegistry';
import type { BaseProvider } from './interfaces/BaseProvider';

export class ProviderFallback {
  /**
   * Executes a task using a sequence of provider IDs.
   * If a provider fails, it attempts the next provider in the sequence.
   * 
   * @param providerIds - An array of provider IDs in order of preference.
   * @param executeFn - The function to execute on the provider.
   */
  static async executeWithFallback<T extends BaseProvider, R>(
    providerIds: string[],
    executeFn: (provider: T) => Promise<R>
  ): Promise<R> {
    const errors: Error[] = [];

    for (const id of providerIds) {
      if (!ProviderRegistry.isEnabled(id)) {
        errors.push(new Error(`Provider ${id} is disabled or not found.`));
        continue;
      }

      const provider = ProviderRegistry.getProvider<T>(id);
      if (!provider) {
        errors.push(new Error(`Provider ${id} not found.`));
        continue;
      }

      try {
        const isHealthy = await provider.healthCheck();
        if (!isHealthy) {
          throw new Error(`Provider ${id} health check failed.`);
        }

        // Return immediately on success
        return await executeFn(provider);
      } catch (error: any) {
        console.warn(`Provider ${id} failed:`, error.message);
        errors.push(error);
        // Continue to the next provider
      }
    }

    throw new Error(`All providers in fallback chain failed. Errors: ${errors.map(e => e.message).join(' | ')}`);
  }
}
