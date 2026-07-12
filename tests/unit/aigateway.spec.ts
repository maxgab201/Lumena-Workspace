import { test, expect } from '@playwright/test';
import { AIGateway } from '../../src/lib/providers/AIGateway';
import { ProviderRegistry } from '../../src/lib/providers/ProviderRegistry';
import { MockAIProvider } from '../../src/lib/providers/ai/MockAIProvider';
import { providerConfig } from '../../src/lib/providers/provider.config';

test.describe('AIGateway', () => {
  test.beforeAll(() => {
    // Register mock providers
    ProviderRegistry.register(new MockAIProvider());
    
    // Set fallback to use mock-ai
    providerConfig.fallbacks.ai = ['mock-ai'];
  });

  test('generate returns data from MockAIProvider', async () => {
    const result = await AIGateway.generate('Give me a summary of this document', { docId: '123' });
    
    expect(result.providerId).toBe('mock-ai');
    expect(result.data).toBeDefined();
    expect(result.data?.text).toContain('mock document');
    expect(result.data?.tokensUsed).toBe(150);
  });

  test('generate falls back and throws error when no provider is available', async () => {
    // Temporarily clear config
    const originalConfig = providerConfig.fallbacks.ai;
    providerConfig.fallbacks.ai = ['non-existent-ai'];
    
    try {
      await expect(AIGateway.generate('Test prompt')).rejects.toThrow('All providers in fallback chain failed');
    } finally {
      providerConfig.fallbacks.ai = originalConfig;
    }
  });
});
