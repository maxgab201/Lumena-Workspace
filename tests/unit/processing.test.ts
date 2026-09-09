import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TesseractOCRProvider } from '../../src/lib/providers/tesseract/TesseractOCRProvider';
import type { OCRProvider } from '../../src/lib/providers/interfaces/OCRProvider';

// Mock Supabase
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'mock-db-id', workspace_id: 'ws-1', document_id: 'doc-1', status: 'queued', progress: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            error: null
          })
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      }))
    }))
  }
}));

describe('TesseractOCRProvider', () => {
  let provider: TesseractOCRProvider;

  beforeEach(() => {
    provider = new TesseractOCRProvider();
  });

  it('implements OCRProvider interface', () => {
    // Check it implements the interface
    expect(typeof provider.getMetadata).toBe('function');
    expect(typeof provider.initialize).toBe('function');
    expect(typeof provider.dispose).toBe('function');
    expect(typeof provider.healthCheck).toBe('function');
    expect(typeof provider.processPage).toBe('function');

    // Check metadata
    const metadata = provider.getMetadata();
    expect(metadata.id).toBe('tesseract-ocr');
    expect(metadata.providerType).toBe('ocr');
    expect(metadata.supportsOffline).toBe(true);
    expect(metadata.supportedLanguages).toContain('en');
    expect(metadata.priority).toBe(10);
  });

  it('should have correct metadata structure', () => {
    const metadata = provider.getMetadata();

    expect(metadata).toMatchObject({
      id: 'tesseract-ocr',
      displayName: 'Tesseract OCR (Local)',
      version: '5.0.0',
      providerType: 'ocr',
      supportsOffline: true,
      supportsCPU: true,
      priority: 10,
    });
  });

  it('should have healthCheck method', async () => {
    const result = provider.healthCheck();
    expect(result).toBeInstanceOf(Promise);
  });

  it('should implement OCRProvider interface', () => {
    // Verify it satisfies the OCRProvider interface
    const providerAsInterface: OCRProvider = provider;
    expect(providerAsInterface).toBeDefined();
    expect(typeof providerAsInterface.getMetadata).toBe('function');
    expect(typeof providerAsInterface.initialize).toBe('function');
    expect(typeof providerAsInterface.dispose).toBe('function');
    expect(typeof providerAsInterface.healthCheck).toBe('function');
    expect(typeof providerAsInterface.processPage).toBe('function');
  });
});