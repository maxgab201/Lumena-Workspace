import type { BaseProvider } from './interfaces/BaseProvider';
import type { ProviderType } from './types';

export class ProviderRegistry {
  private static providers = new Map<string, BaseProvider>();
  private static disabledProviders = new Set<string>();

  /**
   * Register a new provider instance.
   */
  static register(provider: BaseProvider): void {
    const metadata = provider.getMetadata();
    this.providers.set(metadata.id, provider);
  }

  /**
   * Unregister an existing provider.
   */
  static unregister(providerId: string): void {
    this.providers.delete(providerId);
    this.disabledProviders.delete(providerId);
  }

  /**
   * Enable a provider for selection.
   */
  static enable(providerId: string): void {
    this.disabledProviders.delete(providerId);
  }

  /**
   * Disable a provider, preventing it from being selected.
   */
  static disable(providerId: string): void {
    if (this.providers.has(providerId)) {
      this.disabledProviders.add(providerId);
    }
  }

  /**
   * Get a specific provider by ID.
   */
  static getProvider<T extends BaseProvider>(providerId: string): T | undefined {
    return this.providers.get(providerId) as T | undefined;
  }

  /**
   * Check if a provider is enabled.
   */
  static isEnabled(providerId: string): boolean {
    return this.providers.has(providerId) && !this.disabledProviders.has(providerId);
  }

  /**
   * List all registered providers.
   */
  static listProviders(): BaseProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * List active (enabled) providers of a specific type.
   */
  static listByCapability(type: ProviderType): BaseProvider[] {
    return this.listProviders().filter(provider => {
      const metadata = provider.getMetadata();
      return metadata.providerType === type && !this.disabledProviders.has(metadata.id);
    });
  }
}
