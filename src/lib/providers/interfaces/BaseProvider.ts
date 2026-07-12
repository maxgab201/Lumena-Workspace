import type { ProviderMetadata } from '../types';

export interface BaseProvider {
  /**
   * Initialize any resources, load models, or authenticate with remote APIs.
   */
  initialize(): Promise<void>;
  
  /**
   * Release resources, memory, or connections.
   */
  dispose(): Promise<void>;
  
  /**
   * Check if the provider is currently available (e.g. reachable, loaded).
   */
  healthCheck(): Promise<boolean>;
  
  /**
   * Get the static metadata of this provider.
   */
  getMetadata(): ProviderMetadata;
}
