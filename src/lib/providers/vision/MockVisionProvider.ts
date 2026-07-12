import type { VisionProvider, VisionData } from '../interfaces/VisionProvider';
import type { DocumentProfile, ProviderResult, ProviderMetadata } from '../types';

export class MockVisionProvider implements VisionProvider {
  private metadata: ProviderMetadata = {
    id: 'mock-vision',
    displayName: 'Mock Vision Provider',
    version: '1.0.0',
    providerType: 'vision',
    supportsOffline: true,
    supportsGPU: false,
    supportsCPU: true,
    supportsTables: true,
    supportsImages: true,
    supportsMath: true,
    supportsHandwriting: true,
    supportsMultiColumn: true,
    supportedLanguages: ['en'],
    averageLatency: 500, // Vision models are generally slower
    estimatedCost: 0,
    qualityScore: 90,
    confidenceScore: 95,
    priority: 1,
    status: 'active',
    license: 'MIT',
  };

  // Simulate a heavy VLM's processing time
  private processingDelayMs = 500;

  async initialize(): Promise<void> {
    console.log(`[MockVisionProvider] Initialized`);
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

  async analyzeImage(_imageBlob: Blob, prompt: string, _profile: DocumentProfile): Promise<ProviderResult<VisionData>> {
    const start = performance.now();
    
    // Simulate async VLM inference delay
    await new Promise(resolve => setTimeout(resolve, this.processingDelayMs));

    // Return a mocked VisionData response
    const visionData: VisionData = {
      text: `[Mock Vision Response] I have analyzed the page based on the prompt: "${prompt}". The page appears to contain structured text and possibly a table.`,
      objects: [
        {
          label: 'visual_element',
          confidence: 0.98,
          bbox: [0.1, 0.1, 0.9, 0.9]
        }
      ]
    };

    return {
      providerId: this.metadata.id,
      data: visionData,
      confidence: 0.95,
      executionTime: performance.now() - start
    };
  }

  async dispose(): Promise<void> {
    console.log(`[MockVisionProvider] Disposed`);
  }
}
