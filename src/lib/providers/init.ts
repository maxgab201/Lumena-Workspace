import { ProviderRegistry } from './ProviderRegistry';
import { TesseractOCRProvider } from './tesseract/TesseractOCRProvider';
import { MockLayoutProvider } from './layout/MockLayoutProvider';
import { MockVisionProvider } from './vision/MockVisionProvider';
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
