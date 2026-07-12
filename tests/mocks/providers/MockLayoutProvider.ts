import type { LayoutProvider, LayoutData } from '../../../src/lib/providers/interfaces';
import type { ProviderMetadata, DocumentProfile, ProviderResult } from '../../../src/lib/providers/types';

export class MockLayoutProvider implements LayoutProvider {
  private metadata: ProviderMetadata;

  constructor(id: string) {
    this.metadata = {
      id,
      displayName: `Mock Layout ${id}`,
      version: '1.0.0',
      providerType: 'layout',
      supportsOffline: true,
      supportsGPU: false,
      supportsCPU: true,
      supportsTables: true,
      supportsImages: true,
      supportsMath: true,
      supportsHandwriting: false,
      supportsMultiColumn: true,
      supportedLanguages: [],
      averageLatency: 800,
      estimatedCost: 0,
      qualityScore: 85,
      confidenceScore: 85,
      priority: 1,
      status: 'active',
      license: 'MIT'
    };
  }

  async initialize(): Promise<void> {}
  async dispose(): Promise<void> {}
  async healthCheck(): Promise<boolean> { return true; }
  getMetadata(): ProviderMetadata { return this.metadata; }

  async analyzeLayout(_imageBlob: Blob, _profile: DocumentProfile): Promise<ProviderResult<LayoutData>> {
    return {
      data: {
        elements: [
          { id: '1', type: 'title', bbox: [10, 10, 100, 30], confidence: 0.95 }
        ],
        readingOrder: [0]
      },
      confidence: 0.95,
      executionTime: 200,
      providerId: this.metadata.id,
      metadata: { mock: true }
    };
  }
}
