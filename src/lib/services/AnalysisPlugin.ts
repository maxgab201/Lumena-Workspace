/**
 * AnalysisPlugin - Interface for AI analysis plugins
 *
 * Each plugin handles one type of analysis (highlights, summary, etc.)
 * Plugins declare their dependencies and can be composed freely.
 */

import type { TextChunk } from '../processing/TextChunker';

export interface PluginContext {
  documentId: string;
  documentPages: any[];
  chunks: TextChunk[];
  highlights: any[];
  version: number;
}

export interface AnalysisPlugin {
  /** Unique task type identifier */
  taskType: string;

  /** Tasks that must complete before this one can run */
  dependencies: string[];

  /** Check if this plugin can run for the given document */
  canRun(documentId: string): Promise<boolean>;

  /** Execute the analysis and return results */
  execute(documentId: string, context: PluginContext): Promise<any>;

  /** Get cache key for storing results */
  getCacheKey(documentId: string): string;
}
