/**
 * HybridSearchConfig — Configurable strategies for hybrid search.
 *
 * Combines Full-Text Search (FTS) with Vector Search (semantic).
 * Different strategies for different use cases:
 * - balanced: general purpose (default)
 * - semantic_first: conceptual queries
 * - lexical_first: exact match queries (code, names)
 * - semantic_only: pure vector search
 * - lexical_only: pure text search (graceful degradation)
 */

export type HybridStrategy =
  | 'balanced'
  | 'semantic_first'
  | 'lexical_first'
  | 'semantic_only'
  | 'lexical_only';

export interface HybridSearchWeights {
  ftsWeight: number;
  vectorWeight: number;
}

const STRATEGIES: Record<HybridStrategy, HybridSearchWeights> = {
  balanced:       { ftsWeight: 0.3, vectorWeight: 0.7 },
  semantic_first: { ftsWeight: 0.1, vectorWeight: 0.9 },
  lexical_first:  { ftsWeight: 0.7, vectorWeight: 0.3 },
  semantic_only:  { ftsWeight: 0.0, vectorWeight: 1.0 },
  lexical_only:   { ftsWeight: 1.0, vectorWeight: 0.0 },
};

/**
 * Get weights for a given strategy.
 */
export function getStrategyWeights(strategy: HybridStrategy): HybridSearchWeights {
  return STRATEGIES[strategy] ?? STRATEGIES.balanced;
}

/**
 * Get all available strategies (for UI dropdowns).
 */
export function getAvailableStrategies(): Array<{ id: HybridStrategy; label: string; description: string }> {
  return [
    { id: 'balanced', label: 'Balanced', description: 'Mix of text and semantic search' },
    { id: 'semantic_first', label: 'Semantic First', description: 'Prioritize meaning over exact words' },
    { id: 'lexical_first', label: 'Text First', description: 'Prioritize exact text matches' },
    { id: 'semantic_only', label: 'Semantic Only', description: 'Pure vector similarity search' },
    { id: 'lexical_only', label: 'Text Only', description: 'Pure full-text search (no embeddings needed)' },
  ];
}
