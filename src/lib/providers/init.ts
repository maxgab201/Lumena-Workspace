import { ProviderRegistry } from './ProviderRegistry';
import { TesseractOCRProvider } from './tesseract/TesseractOCRProvider';
import { providerConfig } from './provider.config';

export function initializeProviders() {
  // Register OCR Providers
  const tesseract = new TesseractOCRProvider();
  ProviderRegistry.register(tesseract);

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
