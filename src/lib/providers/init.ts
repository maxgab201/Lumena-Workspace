import { ProviderRegistry } from './ProviderRegistry';
import { TesseractOCRProvider } from './tesseract/TesseractOCRProvider';
import { MockLayoutProvider } from './layout/MockLayoutProvider';
import { MockVisionProvider } from './vision/MockVisionProvider';
import { MockAIProvider } from './ai/MockAIProvider';
import { providerConfig } from './provider.config';

export function initializeProviders() {
  // Register OCR Providers
  const tesseract = new TesseractOCRProvider();
  ProviderRegistry.register(tesseract);

  // Register Layout Providers
  const mockLayout = new MockLayoutProvider();
  ProviderRegistry.register(mockLayout);

  // Register Vision Providers
  const mockVision = new MockVisionProvider();
  ProviderRegistry.register(mockVision);

  // Register AI Providers
  const mockAi = new MockAIProvider();
  ProviderRegistry.register(mockAi);

  // Apply overrides from config
  for (const [id, config] of Object.entries(providerConfig.overrides)) {
    if (config.enabled) {
      ProviderRegistry.enable(id);
    } else {
      ProviderRegistry.disable(id);
    }
  }

  console.log('Provider Framework initialized.', ProviderRegistry.listProviders().map(p => p.getMetadata().id));
}
