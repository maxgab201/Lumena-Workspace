import type { BaseProvider } from './BaseProvider';
import type { DocumentProfile, ProviderResult } from '../types';

export interface DocumentInspector extends BaseProvider {
  /**
   * Inspect a document (or portion) to determine its properties.
   */
  inspect(documentData: any, profile?: Partial<DocumentProfile>): Promise<ProviderResult<DocumentProfile>>;
}
