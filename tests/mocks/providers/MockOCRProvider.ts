import type { OCRProvider, OCRData } from '../../../src/lib/providers/interfaces';
import type { ProviderMetadata, DocumentProfile, ProviderResult } from '../../../src/lib/providers/types';

export class MockOCRProvider implements OCRProvider {
  private metadata: ProviderMetadata;
  private shouldFail: boolean;

  constructor(id: string, priority: number, quality: number, shouldFail: boolean = false) {
    this.metadata = {
      id,
      displayName: `Mock OCR ${id}`,
      version: '1.0.0',
      providerType: 'ocr',
      supportsOffline: true,
      supportsGPU: false,
      supportsCPU: true,
      supportsTables: true,
      supportsImages: false,
      supportsMath: false,
      supportsHandwriting: false,
      supportsMultiColumn: true,
      supportedLanguages: ['en', 'es', 'fr'],
      averageLatency: 500,
      estimatedCost: 0,
      qualityScore: quality,
      confidenceScore: 90,
      priority,
      status: 'active',
      license: 'MIT'
    };
    this.shouldFail = shouldFail;
  }

  async initialize(): Promise<void> {}
  async dispose(): Promise<void> {}
  
  async healthCheck(): Promise<boolean> {
    return true;
  }
  
  getMetadata(): ProviderMetadata {
    return this.metadata;
  }

  async processPage(imageBlob: Blob, profile: DocumentProfile): Promise<ProviderResult<OCRData>> {
    if (this.shouldFail) {
      throw new Error(`MockOCRProvider ${this.metadata.id} simulated failure.`);
    }

    return {
      data: {
        text: 'Mocked OCR Text',
        blocks: [
          { text: 'Mocked', bbox: [0, 0, 10, 10], confidence: 0.99, type: 'text' }
        ]
      },
      confidence: 0.99,
      executionTime: 120,
      providerId: this.metadata.id,
      metadata: { mock: true }
    };
  }
}
