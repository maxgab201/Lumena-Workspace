export type ProviderType = 'extraction' | 'ocr' | 'layout' | 'vision';

export interface ProviderMetadata {
  id: string;
  name: string;
  version: string;
  type: ProviderType;
  description: string;
  capabilities: string[];
}

export interface IProcessingProvider {
  getMetadata(): ProviderMetadata;
  // Future: Process(job) method will be defined here
}

class ProviderRegistryImpl {
  private providers: Map<string, IProcessingProvider> = new Map();

  registerProvider(provider: IProcessingProvider): void {
    const metadata = provider.getMetadata();
    if (this.providers.has(metadata.id)) {
      console.warn(`Provider ${metadata.id} is already registered. Overwriting.`);
    }
    this.providers.set(metadata.id, provider);
  }

  removeProvider(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  getProvider(providerId: string): IProcessingProvider | undefined {
    return this.providers.get(providerId);
  }

  listProviders(): ProviderMetadata[] {
    return Array.from(this.providers.values()).map(p => p.getMetadata());
  }

  getProvidersByType(type: ProviderType): ProviderMetadata[] {
    return this.listProviders().filter(p => p.type === type);
  }
}

export const ProviderRegistry = new ProviderRegistryImpl();
