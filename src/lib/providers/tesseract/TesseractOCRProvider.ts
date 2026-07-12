import { createWorker, type Worker } from 'tesseract.js';
import type { OCRProvider, OCRData, OCRBlock } from '../interfaces/OCRProvider';
import type { ProviderMetadata, DocumentProfile, ProviderResult } from '../types';

export class TesseractOCRProvider implements OCRProvider {
  private worker: Worker | null = null;
  private isInitialized = false;

  private metadata: ProviderMetadata = {
    id: 'tesseract-ocr',
    displayName: 'Tesseract OCR (Local)',
    version: '5.0.0', // tesseract.js v5
    providerType: 'ocr',
    supportsOffline: true,
    supportsGPU: false,
    supportsCPU: true,
    supportsTables: false,
    supportsImages: false,
    supportsMath: false,
    supportsHandwriting: false,
    supportsMultiColumn: false,
    supportedLanguages: ['en', 'es', 'fr', 'de', 'pt'], // Can be expanded dynamically
    averageLatency: 2500, // Depends heavily on image size and CPU
    estimatedCost: 0,
    qualityScore: 60, // Basic quality compared to Surya/Cloud
    confidenceScore: 70,
    priority: 10, // Lowest priority, ultimate fallback
    status: 'active',
    license: 'Apache-2.0',
  };

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // We create the worker, but we don't load a specific language yet 
    // because language depends on the document profile.
    // We will initialize the specific language just-in-time during processPage 
    // or we could default to 'eng'. Let's default to 'eng' for health checks.
    try {
      this.worker = await createWorker('eng');
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize TesseractOCRProvider:', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.worker) {
        await this.initialize();
      }
      return this.isInitialized && this.worker !== null;
    } catch {
      return false;
    }
  }

  getMetadata(): ProviderMetadata {
    return this.metadata;
  }

  async processPage(imageBlob: Blob, profile: DocumentProfile): Promise<ProviderResult<OCRData>> {
    const startTime = performance.now();
    
    if (imageBlob.type === 'application/pdf') {
      throw new Error('TesseractOCRProvider requires an image Blob. PDF-to-Image extraction is required upstream.');
    }

    if (!this.isInitialized || !this.worker) {
      await this.initialize();
    }

    if (!this.worker) {
      throw new Error('Tesseract worker failed to initialize.');
    }

    // Convert Blob to File or ArrayBuffer/URL that Tesseract can read
    // Tesseract.js accepts a File, Blob, or Object URL.
    const imageObjectUrl = URL.createObjectURL(imageBlob);

    try {
      // Re-initialize with the correct language if provided
      const langMap: Record<string, string> = {
        'en': 'eng',
        'es': 'spa',
        'fr': 'fra',
        'de': 'deu',
        'pt': 'por'
      };
      
      const targetLang = profile.primaryLanguage && langMap[profile.primaryLanguage] 
        ? langMap[profile.primaryLanguage] 
        : 'eng';
        
      await this.worker.reinitialize(targetLang);

      // Perform OCR
      const { data } = await this.worker.recognize(imageObjectUrl);
      
      const executionTime = performance.now() - startTime;

      // Map Tesseract output to our standard OCRData format
      const tesseractData = data as any;
      const blocks: OCRBlock[] = (tesseractData.words || []).map((word: any) => ({
        text: word.text,
        bbox: [
          word.bbox.x0,
          word.bbox.y0,
          word.bbox.x1,
          word.bbox.y1
        ],
        confidence: word.confidence / 100, // Tesseract returns 0-100, we want 0-1
        type: 'text'
      }));

      const overallConfidence = data.confidence / 100;

      return {
        data: {
          text: data.text,
          blocks
        },
        confidence: overallConfidence,
        executionTime,
        providerId: this.metadata.id,
        metadata: {
          tesseractVersion: data.version,
          language: targetLang,
        }
      };
    } finally {
      URL.revokeObjectURL(imageObjectUrl);
    }
  }
}
