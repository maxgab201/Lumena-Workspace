import type { BaseProvider } from './BaseProvider';
import type { DocumentProfile, ProviderResult } from '../types';

export interface LayoutData {
  elements: LayoutElement[];
  readingOrder: number[];
}

export interface LayoutElement {
  id: string;
  type: 'title' | 'text' | 'list' | 'table' | 'figure' | 'header' | 'footer' | 'equation';
  bbox: [number, number, number, number]; // x0, y0, x1, y1
  confidence: number;
}

export interface LayoutProvider extends BaseProvider {
  /**
   * Analyze the structural layout of a page image.
   */
  analyzeLayout(imageBlob: Blob, profile: DocumentProfile): Promise<ProviderResult<LayoutData>>;
}
