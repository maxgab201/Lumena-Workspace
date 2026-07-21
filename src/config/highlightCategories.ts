/**
 * Highlight Categories - Configurable AI highlight types
 *
 * Each category has a color, label, and can be enabled/disabled.
 * Users can customize which categories to show.
 */

export type HighlightCategory =
  | 'concept'
  | 'definition'
  | 'formula'
  | 'date'
  | 'fact'
  | 'person'
  | 'location'
  | 'relationship'
  | 'warning'
  | 'keyword'
  | 'question'
  | 'summary'
  | 'example'
  | 'reference';

export interface CategoryConfig {
  color: string;
  label: string;
  description: string;
  enabled: boolean;
}

export const HIGHLIGHT_CATEGORIES: Record<HighlightCategory, CategoryConfig> = {
  concept: { color: '#fef08a', label: 'Concept', description: 'Core ideas and main concepts', enabled: true },
  definition: { color: '#93c5fd', label: 'Definition', description: 'Key definitions and explanations', enabled: true },
  formula: { color: '#c4b5fd', label: 'Formula', description: 'Mathematical expressions and formulas', enabled: true },
  date: { color: '#fca5a5', label: 'Date', description: 'Important dates and timelines', enabled: true },
  fact: { color: '#86efac', label: 'Fact', description: 'Key facts and data points', enabled: true },
  person: { color: '#fcd34d', label: 'Person', description: 'People mentioned in document', enabled: false },
  location: { color: '#a78bfa', label: 'Location', description: 'Places and locations mentioned', enabled: false },
  relationship: { color: '#fb923c', label: 'Relationship', description: 'Connections between concepts', enabled: true },
  warning: { color: '#f87171', label: 'Warning', description: 'Cautions, warnings, and alerts', enabled: true },
  keyword: { color: '#34d399', label: 'Keyword', description: 'Important keywords and terms', enabled: true },
  question: { color: '#60a5fa', label: 'Question', description: 'Questions raised in document', enabled: true },
  summary: { color: '#a78bfa', label: 'Summary', description: 'Key summaries and conclusions', enabled: true },
  example: { color: '#fbbf24', label: 'Example', description: 'Important examples and illustrations', enabled: true },
  reference: { color: '#94a3b8', label: 'Reference', description: 'Citations and references', enabled: false },
};

export function getCategoryConfig(category: HighlightCategory): CategoryConfig {
  return HIGHLIGHT_CATEGORIES[category] || HIGHLIGHT_CATEGORIES.concept;
}
