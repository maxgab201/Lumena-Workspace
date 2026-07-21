/**
 * AIAnalysisService - Centralized AI operations
 *
 * Handles all AI generation with provider abstraction.
 */

import { AIGateway } from '../providers/AIGateway';
import { PromptBuilder } from './PromptBuilder';
import { AnalysisCache } from './AnalysisCache';
import type { TextChunk } from '../processing/TextChunker';

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

export interface AIHighlight {
  text: string;
  category: HighlightCategory;
  confidence: number;
  reasoning: string;
  pageNumber: number;
}

export class AIAnalysisService {
  private cache: AnalysisCache;

  constructor() {
    this.cache = new AnalysisCache();
  }

  async generateHighlights(
    documentId: string,
    pageNumber: number,
    pageText: string,
    documentContext: string
  ): Promise<AIHighlight[]> {
    const cacheKey = `highlights_p${pageNumber}`;
    const cached = await this.cache.get(documentId, cacheKey);
    if (cached) return cached as AIHighlight[];

    const prompt = PromptBuilder.buildHighlightPrompt({
      pageNumber,
      pageText,
      documentContext,
    });

    const response = await AIGateway.generate(prompt);

    try {
      const highlights = JSON.parse(response.text) as AIHighlight[];
      await this.cache.set(documentId, cacheKey, highlights);
      return highlights;
    } catch {
      return [];
    }
  }

  async generateSummary(
    documentId: string,
    pageChunks: TextChunk[]
  ): Promise<string> {
    const cached = await this.cache.get(documentId, 'summary');
    if (cached) return cached as string;

    const prompt = PromptBuilder.buildSummaryPrompt(pageChunks);
    const response = await AIGateway.generate(prompt);

    await this.cache.set(documentId, 'summary', response.text);
    return response.text;
  }

  async generateGlossary(
    documentId: string,
    pageChunks: TextChunk[]
  ): Promise<Array<{ term: string; definition: string }>> {
    const cached = await this.cache.get(documentId, 'glossary');
    if (cached) return cached as Array<{ term: string; definition: string }>;

    const prompt = PromptBuilder.buildGlossaryPrompt(pageChunks);
    const response = await AIGateway.generate(prompt);

    try {
      const glossary = JSON.parse(response.text) as Array<{ term: string; definition: string }>;
      await this.cache.set(documentId, 'glossary', glossary);
      return glossary;
    } catch {
      return [];
    }
  }
}
