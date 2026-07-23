export type ProviderType = 'ocr' | 'layout' | 'vision' | 'extraction' | 'inspection' | 'ai' | 'embedding';

export interface ProviderMetadata {
  id: string;
  displayName: string;
  version: string;
  providerType: ProviderType;
  
  // Capabilities
  supportsOffline: boolean;
  supportsGPU: boolean;
  supportsCPU: boolean;
  supportsTables: boolean;
  supportsImages: boolean;
  supportsMath: boolean;
  supportsHandwriting: boolean;
  supportsMultiColumn: boolean;
  supportedLanguages: string[]; // ISO 639-1 codes
  
  // Scoring & Metrics (used by Routing Engine)
  averageLatency: number; // ms
  estimatedCost: number; // cost per 1k pages/requests
  qualityScore: number; // 0-100
  confidenceScore: number; // 0-100 typical confidence
  priority: number; // 0 = highest priority, acts as tiebreaker
  
  // Operational
  status: 'active' | 'deprecated' | 'experimental' | 'offline';
  license: string;
  homepage?: string;
}

export interface DocumentProfile {
  isDigital: boolean;
  hasImages: boolean;
  hasTables: boolean;
  hasMath: boolean;
  hasHandwriting: boolean;
  hasMultiColumn: boolean;
  primaryLanguage?: string;
  pageCount: number;
}

export interface ProviderResult<T> {
  data: T;
  confidence: number;
  executionTime: number; // ms
  providerId: string;
  metadata?: Record<string, any>;
}
