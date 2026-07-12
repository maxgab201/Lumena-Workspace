import type { BaseProvider } from './BaseProvider';
import type { DocumentProfile, ProviderResult } from '../types';

export interface VisionData {
  text: string;
  objects?: VisionObject[];
}

export interface VisionObject {
  label: string;
  confidence: number;
  bbox?: [number, number, number, number];
}

export interface VisionProvider extends BaseProvider {
  /**
   * Analyze an image based on a specific prompt (e.g. VQA, extraction).
   */
  analyzeImage(imageBlob: Blob, prompt: string, profile: DocumentProfile): Promise<ProviderResult<VisionData>>;
}
