import type { BaseProvider } from './BaseProvider';
import type { DocumentProfile, ProviderResult } from '../types';

export interface OCRData {
  text: string;
  blocks: OCRBlock[];
}

export interface OCRBlock {
  text: string;
  bbox: [number, number, number, number]; // x0, y0, x1, y1
  confidence: number;
  type?: 'text' | 'title' | 'list' | 'table' | 'figure';
}

export interface OCRProvider extends BaseProvider {
  /**
   * Process a single image (page or crop) and return OCR results.
   */
  processPage(imageBlob: Blob, profile: DocumentProfile): Promise<ProviderResult<OCRData>>;
}
