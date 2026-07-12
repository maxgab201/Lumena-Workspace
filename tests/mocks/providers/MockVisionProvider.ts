import type { VisionProvider, VisionData } from '../../../src/lib/providers/interfaces';
import type { ProviderMetadata, DocumentProfile, ProviderResult } from '../../../src/lib/providers/types';

export class MockVisionProvider implements VisionProvider {
  private metadata: ProviderMetadata;

  constructor(id: string) {
    this.metadata = {
      id,
      displayName: `Mock Vision ${id}`,
      version: '1.0.0',
      providerType: 'vision',
      supportsOffline: false,
      supportsGPU: true,
      supportsCPU: true,
      supportsTables: true,
      supportsImages: true,
      supportsMath: true,
      supportsHandwriting: true,
      supportsMultiColumn: true,
      supportedLanguages: ['en'],
      averageLatency: 2000,
      estimatedCost: 0.01,
      qualityScore: 95,
      confidenceScore: 90,
      priority: 1,
      status: 'active',
      license: 'Commercial'
    };
  }

  async initialize(): Promise<void> {}
  async dispose(): Promise<void> {}
  async healthCheck(): Promise<boolean> { return true; }
  getMetadata(): ProviderMetadata { return this.metadata; }

  async analyzeImage(_imageBlob: Blob, prompt: string, _profile: DocumentProfile): Promise<ProviderResult<VisionData>> {
    return {
      data: {
        text: 'Mocked vision response based on prompt: ' + prompt,
        objects: []
      },
      confidence: 0.9,
      executionTime: 1500,
      providerId: this.metadata.id,
      metadata: { mock: true, prompt }
    };
  }
}
