import type { BaseProvider } from './BaseProvider';
import type { ProviderResult } from '../types';

export interface AIData {
  text: string;
  tokensUsed?: number;
}

export interface AIProvider extends BaseProvider {
  /**
   * Generate text or data based on a prompt and context.
   */
  generate(prompt: string, context?: any): Promise<ProviderResult<AIData>>;
}
