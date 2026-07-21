/**
 * AIAnalysisService - Centralized AI operations
 *
 * Handles all AI generation with provider abstraction.
 */

import { AIGateway } from '../providers/AIGateway';
import { PromptBuilder } from './PromptBuilder';
import { AnalysisCache } from './AnalysisCache';
import type { TextChunk } from '../processing/TextChunker';

export type HighlightCategory = string;

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
    // Check cache first
    const cached = await this.cache.get(documentId, `highlights_p${pageNumber}`);
    if (cached) return cached;

    const prompt = PromptBuilder.buildHighlightPrompt({
      pageNumber,
      pageText,
      documentContext,
    });

    const response = await AIGateway.generate(prompt);

    try {
      const highlights = JSON.parse(response.text);
      await this.cache.set(documentId, `highlights_p${pageNumber}`, highlights);
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
    if (cached) return cached;

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
    if (cached) return cached;

    const prompt = PromptBuilder.buildGlossaryPrompt(pageChunks);
    const response = await AIGateway.generate(prompt);

    try {
      const glossary = JSON.parse(response.text);
      await this.cache.set(documentId, 'glossary', glossary);
      return glossary;
    } catch {
      return [];
    }
  }
}
