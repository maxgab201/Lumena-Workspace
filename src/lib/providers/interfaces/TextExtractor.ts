import type { BaseProvider } from './BaseProvider';
import type { DocumentProfile, ProviderResult } from '../types';

export interface TextData {
  text: string;
}

export interface TextExtractor extends BaseProvider {
  /**
   * Extract native text from a digital document page.
   */
  extractText(pageData: any, profile: DocumentProfile): Promise<ProviderResult<TextData>>;
}
