import type { AIProvider, AIData } from '../interfaces/AIProvider';
import type { ProviderResult, ProviderMetadata } from '../types';

export class MockAIProvider implements AIProvider {
  getMetadata(): ProviderMetadata {
    return {
      id: 'mock-ai',
      displayName: 'Mock AI Provider',
      version: '1.0.0',
      providerType: 'ai' as const,
      supportsOffline: true,
      supportsGPU: false,
      supportsCPU: true,
      supportsTables: true,
      supportsImages: true,
      supportsMath: false,
      supportsHandwriting: false,
      supportsMultiColumn: true,
      supportedLanguages: ['en'],
      averageLatency: 50,
      estimatedCost: 0,
      qualityScore: 100,
      confidenceScore: 100,
      priority: 99,
      status: 'active',
      license: 'MIT'
    };
  }

  async initialize(): Promise<void> {
    // Simulated init
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async dispose(): Promise<void> {
    // Simulated shutdown
  }

  async generate(prompt: string, _context?: any): Promise<ProviderResult<AIData>> {
    const startTime = performance.now();
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const executionTime = performance.now() - startTime;

    // A simple mock logic to return something varying based on prompt
    let mockResponse = `This is a simulated AI response to the prompt: "${prompt.substring(0, 50)}..."`;
    
    if (prompt.toLowerCase().includes('summary')) {
      mockResponse = 'This document appears to be a mock document. It contains structured text, tables, and images. The main topic is placeholder testing for the Lumena Workspace.';
    } else if (prompt.toLowerCase().includes('flashcard')) {
      mockResponse = 'Q: What is Lumena Workspace?\nA: An intelligent knowledge workspace.';
    }

    return {
      data: {
        text: mockResponse,
        tokensUsed: 150
      },
      confidence: 0.99,
      executionTime,
      providerId: this.getMetadata().id
    };
  }
}
