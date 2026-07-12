import type { LayoutProvider, LayoutData } from '../interfaces/LayoutProvider';
import type { DocumentProfile, ProviderResult, ProviderMetadata } from '../types';

export class MockLayoutProvider implements LayoutProvider {
  private metadata: ProviderMetadata = {
    id: 'mock-layout',
    displayName: 'Mock Layout Provider',
    version: '1.0.0',
    providerType: 'layout',
    supportsOffline: true,
    supportsGPU: false,
    supportsCPU: true,
    supportsTables: true,
    supportsImages: true,
    supportsMath: false,
    supportsHandwriting: false,
    supportsMultiColumn: true,
    supportedLanguages: ['en'],
    averageLatency: 200,
    estimatedCost: 0,
    qualityScore: 90,
    confidenceScore: 95,
    priority: 1,
    status: 'active',
    license: 'MIT',
  };
  
  // Simulate a heavy ML model's processing time (e.g., ONNX model inference)
  private processingDelayMs = 200;

  async initialize(): Promise<void> {
    console.log(`[MockLayoutProvider] Initialized`);
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
  
  async healthCheck(): Promise<boolean> {
    return true;
  }
  
  getMetadata(): ProviderMetadata {
    return this.metadata;
  }

  async analyzeLayout(_imageBlob: Blob, _profile: DocumentProfile): Promise<ProviderResult<LayoutData>> {
    const start = performance.now();
    
    // Simulate async ML inference delay
    await new Promise(resolve => setTimeout(resolve, this.processingDelayMs));

    // Return a structured, mock layout representing a typical academic/document page
    const layoutData: LayoutData = {
      elements: [
        {
          id: 'element_header_1',
          type: 'header',
          bbox: [0.1, 0.05, 0.9, 0.1], // normalized coordinates x0, y0, x1, y1
          confidence: 0.98,
        },
        {
          id: 'element_title_1',
          type: 'title',
          bbox: [0.1, 0.15, 0.9, 0.25],
          confidence: 0.99,
        },
        {
          id: 'element_paragraph_1',
          type: 'paragraph',
          bbox: [0.1, 0.3, 0.9, 0.45],
          confidence: 0.95,
        },
        {
          id: 'element_table_1',
          type: 'table',
          bbox: [0.1, 0.5, 0.9, 0.7],
          confidence: 0.91,
        },
        {
          id: 'element_footer_1',
          type: 'footer',
          bbox: [0.1, 0.9, 0.9, 0.95],
          confidence: 0.99,
        }
      ],
      // Logical reading order matches the visual top-to-bottom flow here
      readingOrder: [0, 1, 2, 3, 4] 
    };

    return {
      providerId: this.metadata.id,
      data: layoutData,
      confidence: 0.95,
      executionTime: performance.now() - start
    };
  }

  async dispose(): Promise<void> {
    console.log(`[MockLayoutProvider] Disposed`);
  }
}
