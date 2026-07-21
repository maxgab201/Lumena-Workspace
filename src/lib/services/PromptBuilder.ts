/**
 * PromptBuilder - Unified system for all AI prompts
 *
 * Centralizes prompt construction for chat, highlights, summary, etc.
 */

import type { TextChunk } from '../processing/TextChunker';

export interface ChatPromptParams {
  userQuery: string;
  documentName: string;
  pageChunks: TextChunk[];
  highlights: Highlight[];
  conversationHistory: Array<{ role: string; content: string }>;
  currentPage: number;
}

export interface HighlightPromptParams {
  pageNumber: number;
  pageText: string;
  documentContext: string;
}

export class PromptBuilder {
  static buildChatPrompt(params: ChatPromptParams): string {
    const contextChunks = params.pageChunks
      .map(c => `[Page ${c.pageNumber}] ${c.content}`)
      .join('\n\n');

    const highlightsText = params.highlights
      .map((h: any) => `[${h.category}] ${h.text}`)
      .join('\n');

    const historyText = params.conversationHistory
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    return `System: You are Lumena AI, an expert document analysis assistant.

Document: ${params.documentName}
Current Page: ${params.currentPage}

Relevant Content:
${contextChunks}

Key Highlights:
${highlightsText}

${historyText ? `Previous conversation:\n${historyText}` : ''}

User: ${params.userQuery}`;
  }

  static buildHighlightPrompt(params: HighlightPromptParams): string {
    return `Analyze this document page and identify important content.

Page ${params.pageNumber}:
${params.pageText}

For each item found, return:
- text: The exact text as it appears in the document
- category: One of [concept, definition, formula, date, fact, person, location, relationship, warning, keyword, question, summary, example, reference]
- confidence: How confident you are (0.0-1.0)
- reasoning: Brief explanation of why it's important

Return JSON array. Do not invent text that doesn't exist in the document.`;
  }

  static buildSummaryPrompt(pageChunks: TextChunk[]): string {
    const content = pageChunks
      .map(c => `[Page ${c.pageNumber}] ${c.content}`)
      .join('\n\n');

    return `Provide a concise summary of this document.

Content:
${content}

Return a clear, well-structured summary in 2-3 paragraphs.`;
  }

  static buildGlossaryPrompt(pageChunks: TextChunk[]): string {
    const content = pageChunks
      .map(c => c.content)
      .join('\n\n');

    return `Extract key terms and their definitions from this document.

Content:
${content}

Return JSON array with { term, definition } objects.`;
  }

  static buildTimelinePrompt(pageChunks: TextChunk[]): string {
    const content = pageChunks
      .map(c => c.content)
      .join('\n\n');

    return `Extract chronological events from this document.

Content:
${content}

Return JSON array with { date, event, description } objects.`;
  }

  static buildFlashcardPrompt(pageChunks: TextChunk[]): string {
    const content = pageChunks
      .map(c => c.content)
      .join('\n\n');

    return `Create study flashcards from this document.

Content:
${content}

Return JSON array with { question, answer } objects.`;
  }
}
