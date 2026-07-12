import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../../../src/lib/providers/ProviderRegistry';
import { ProviderRouter } from '../../../src/lib/providers/ProviderRouter';
import { ProviderFallback } from '../../../src/lib/providers/ProviderFallback';
import { MockOCRProvider } from '../../mocks/providers/MockOCRProvider';
import { MockLayoutProvider } from '../../mocks/providers/MockLayoutProvider';
import type { DocumentProfile } from '../../../src/lib/providers/types';
import type { OCRProvider, LayoutProvider } from '../../../src/lib/providers/interfaces';

describe('Provider Framework', () => {
  const profile: DocumentProfile = {
    isDigital: false,
    hasImages: false,
    hasTables: true,
    hasMath: false,
    hasHandwriting: false,
    hasMultiColumn: true,
    pageCount: 1,
    primaryLanguage: 'en'
  };

  beforeEach(() => {
    // Clear registry for clean tests (since it's a static singleton, we just unregister what we add)
    ProviderRegistry.listProviders().forEach(p => ProviderRegistry.unregister(p.getMetadata().id));
  });

  describe('ProviderRegistry', () => {
    it('registers and lists providers by capability', () => {
      const ocr1 = new MockOCRProvider('ocr-1', 1, 90);
      const layout1 = new MockLayoutProvider('layout-1');
      
      ProviderRegistry.register(ocr1);
      ProviderRegistry.register(layout1);

      const ocrProviders = ProviderRegistry.listByCapability('ocr');
      expect(ocrProviders).toHaveLength(1);
      expect(ocrProviders[0].getMetadata().id).toBe('ocr-1');

      const layoutProviders = ProviderRegistry.listByCapability('layout');
      expect(layoutProviders).toHaveLength(1);
      expect(layoutProviders[0].getMetadata().id).toBe('layout-1');
    });

    it('can disable and enable providers', () => {
      const ocr1 = new MockOCRProvider('ocr-1', 1, 90);
      ProviderRegistry.register(ocr1);

      expect(ProviderRegistry.isEnabled('ocr-1')).toBe(true);
      expect(ProviderRegistry.listByCapability('ocr')).toHaveLength(1);

      ProviderRegistry.disable('ocr-1');
      expect(ProviderRegistry.isEnabled('ocr-1')).toBe(false);
      expect(ProviderRegistry.listByCapability('ocr')).toHaveLength(0);

      ProviderRegistry.enable('ocr-1');
      expect(ProviderRegistry.isEnabled('ocr-1')).toBe(true);
      expect(ProviderRegistry.listByCapability('ocr')).toHaveLength(1);
    });
  });

  describe('ProviderRouter', () => {
    it('selects the best provider based on quality score and priority', () => {
      const goodOcr = new MockOCRProvider('good-ocr', 2, 80);
      const excellentOcr = new MockOCRProvider('excellent-ocr', 1, 95);
      
      ProviderRegistry.register(goodOcr);
      ProviderRegistry.register(excellentOcr);

      const best = ProviderRouter.getBestProvider<OCRProvider>('ocr', profile);
      expect(best?.getMetadata().id).toBe('excellent-ocr');
    });

    it('returns null if no providers match the capability', () => {
      const best = ProviderRouter.getBestProvider<LayoutProvider>('layout', profile);
      expect(best).toBeNull();
    });
  });

  describe('ProviderFallback', () => {
    it('executes the first successful provider', async () => {
      const ocr1 = new MockOCRProvider('ocr-fail', 1, 90, true); // Will fail
      const ocr2 = new MockOCRProvider('ocr-success', 2, 80, false); // Will succeed
      
      ProviderRegistry.register(ocr1);
      ProviderRegistry.register(ocr2);

      const result = await ProviderFallback.executeWithFallback<OCRProvider, any>(
        ['ocr-fail', 'ocr-success'],
        async (provider) => await provider.processPage(new Blob(), profile)
      );

      expect(result.providerId).toBe('ocr-success');
      expect(result.data.text).toBe('Mocked OCR Text');
    });

    it('throws if all providers fail', async () => {
      const ocr1 = new MockOCRProvider('ocr-fail-1', 1, 90, true);
      const ocr2 = new MockOCRProvider('ocr-fail-2', 2, 80, true);
      
      ProviderRegistry.register(ocr1);
      ProviderRegistry.register(ocr2);

      await expect(ProviderFallback.executeWithFallback<OCRProvider, any>(
        ['ocr-fail-1', 'ocr-fail-2'],
        async (provider) => await provider.processPage(new Blob(), profile)
      )).rejects.toThrow(/All providers in fallback chain failed/);
    });
  });
});
