import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TesseractOCRProvider } from '../../../src/lib/providers/tesseract/TesseractOCRProvider';
import * as Tesseract from 'tesseract.js';
import type { DocumentProfile } from '../../../src/lib/providers/types';

// Mock tesseract.js
vi.mock('tesseract.js', () => {
  return {
    createWorker: vi.fn()
  };
});

describe('TesseractOCRProvider', () => {
  let provider: TesseractOCRProvider;

  const mockProfile: DocumentProfile = {
    isDigital: false,
    hasImages: false,
    hasTables: false,
    hasMath: false,
    hasHandwriting: false,
    hasMultiColumn: false,
    pageCount: 1,
    primaryLanguage: 'en'
  };

  const mockTesseractResult = {
    data: {
      text: 'Hello World',
      confidence: 85,
      version: '5.0.0',
      words: [
        {
          text: 'Hello',
          confidence: 90,
          bbox: { x0: 0, y0: 0, x1: 50, y1: 20 }
        },
        {
          text: 'World',
          confidence: 80,
          bbox: { x0: 60, y0: 0, x1: 110, y1: 20 }
        }
      ]
    }
  };

  let mockWorker: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock URL.createObjectURL and URL.revokeObjectURL for tests
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    mockWorker = {
      reinitialize: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockResolvedValue(mockTesseractResult),
      terminate: vi.fn().mockResolvedValue(undefined)
    };

    (Tesseract.createWorker as any).mockResolvedValue(mockWorker);
    
    provider = new TesseractOCRProvider();
  });

  it('initializes the worker correctly', async () => {
    await provider.initialize();
    expect(Tesseract.createWorker).toHaveBeenCalledWith('eng');
    
    const isHealthy = await provider.healthCheck();
    expect(isHealthy).toBe(true);
  });

  it('processes a page and maps results to standard format', async () => {
    const blob = new Blob(['mock-image-data'], { type: 'image/png' });
    
    const result = await provider.processPage(blob, mockProfile);
    
    expect(mockWorker.reinitialize).toHaveBeenCalledWith('eng');
    expect(mockWorker.recognize).toHaveBeenCalledWith('blob:mock-url');
    
    expect(result.providerId).toBe('tesseract-ocr');
    expect(result.confidence).toBe(0.85); // 85 / 100
    expect(result.data.text).toBe('Hello World');
    expect(result.data.blocks).toHaveLength(2);
    expect(result.data.blocks[0]).toEqual({
      text: 'Hello',
      bbox: [0, 0, 50, 20],
      confidence: 0.9,
      type: 'text'
    });
  });

  it('uses the correct language mapping from profile', async () => {
    const blob = new Blob(['mock-image-data'], { type: 'image/png' });
    
    const esProfile = { ...mockProfile, primaryLanguage: 'es' };
    await provider.processPage(blob, esProfile);
    
    expect(mockWorker.reinitialize).toHaveBeenCalledWith('spa');
  });

  it('cleans up worker on dispose', async () => {
    await provider.initialize();
    await provider.dispose();
    
    expect(mockWorker.terminate).toHaveBeenCalled();
  });
});
