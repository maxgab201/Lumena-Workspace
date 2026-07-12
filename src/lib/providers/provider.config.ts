/**
 * Provider Framework Configuration
 * 
 * Defines the available providers and fallback sequences.
 * Concrete providers will be instantiated and registered here as they are implemented.
 */

export const providerConfig = {
  // Define fallback sequences for specific capabilities
  fallbacks: {
    ocr: [
      'surya-ocr',      // Primary (High quality, local)
      'paddle-ocr',     // Secondary (Good fallback)
      'mistral-ocr',    // Cloud fallback
      'tesseract-ocr'   // Ultimate fallback (Fast, basic)
    ],
    layout: [
      'surya-layout',
      'docling'
    ],
    vision: [
      'gpt-4o-vision',
      'claude-3-opus'
    ]
  },
  
  // Enable or disable specific providers (overrides default registry status)
  overrides: {
    'tesseract-ocr': { enabled: true },
    'surya-ocr': { enabled: true },
    // Temporarily disabled for testing
    'mistral-ocr': { enabled: false }
  }
};
