/**
 * Embedding Service
 *
 * Generates embeddings using Google's Gemini Embedding model.
 * Designed to be provider-agnostic for future extensibility.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EmbeddingResult {
  embedding: number[];
  tokensUsed: number;
}

export interface EmbeddingBatchResult {
  embeddings: number[][];
  totalTokens: number;
}

export interface EmbeddingProviderConfig {
  apiKey: string;
  model?: string;
  dimensions?: number;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly name: string;
  readonly dimensions: number;
  generateEmbedding(text: string): Promise<{ embedding: number[]; tokensUsed: number }>;
  generateEmbeddingsBatch(texts: string[]): Promise<{ embeddings: number[][]; totalTokens: number }>;
}

/**
 * Gemini Embedding Provider
 * Uses Google's Generative AI SDK for embeddings
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'gemini';
  readonly name = 'Gemini Embeddings';
  readonly dimensions = 768; // Gemini embedding-001 produces 768-dimensional vectors

  private model: any;

  constructor(apiKey: string, model: string = 'embedding-001') {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model });
  }

  async generateEmbedding(text: string): Promise<{ embedding: number[]; tokensUsed: number }> {
    try {
      // Truncate if too long (Gemini embedding-001 has 2048 token limit)
      const truncatedText = text.slice(0, 8000);

      const result = await this.model.embedContent(truncatedText);
      const embedding = result.embedding.values;

      // Estimate tokens (rough: 1 token ≈ 4 chars)
      const tokensUsed = Math.min(2048, Math.ceil(text.length / 4));

      return {
        embedding,
        tokensUsed,
      };
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<{ embeddings: number[][]; totalTokens: number }> {
    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const text of texts) {
      const result = await this.generateEmbedding(text);
      embeddings.push(result.embedding);
      totalTokens += result.tokensUsed;
    }

    return { embeddings, totalTokens };
  }
}

// Singleton instance
let embeddingProviderInstance: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!embeddingProviderInstance) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_GEMINI_API_KEY environment variable is required');
    }
    embeddingProviderInstance = new GeminiEmbeddingProvider(apiKey);
  }
  return embeddingProviderInstance;
}

/**
 * Embedding Service
 * High-level service for generating and managing embeddings
 */
export class EmbeddingService {
  private provider: EmbeddingProvider;

  constructor() {
    this.provider = getEmbeddingProvider();
  }

  async generateEmbeddings(texts: string[], _documentId: string, _workspaceId: string): Promise<{
    embeddings: number[][];
    chunks: string[];
    tokenCounts: number[];
    totalTokens: number;
  }> {
    const result = await this.provider.generateEmbeddingsBatch(texts);
    return {
      embeddings: result.embeddings,
      chunks: texts,
      tokenCounts: texts.map(t => Math.ceil(t.length / 4)),
      totalTokens: result.totalTokens,
    };
  }

  async chunkAndEmbed(
    text: string,
    _documentId: string,
    _workspaceId: string,
    options: { maxTokens?: number; overlapTokens?: number } = {}
  ) {
    // Import chunking utility
    const { chunkText } = await import('../processing/chunking');

    const chunks = chunkText(text, {
      maxTokens: options.maxTokens || 512,
      overlapTokens: options.overlapTokens || 50,
    });

    const texts = chunks.map((c: { text: string }) => c.text);
    const embeddingsResult = await this.generateEmbeddings(texts, '', '');

    return {
      chunks: chunks.map((chunk: { text: string; tokenCount: number; startIndex: number; endIndex: number }, i: number) => ({
        text: chunk.text,
        embedding: embeddingsResult.embeddings[i],
        tokenCount: chunk.tokenCount,
        startIndex: chunk.startIndex,
        endIndex: chunk.endIndex,
      })),
      totalTokens: embeddingsResult.totalTokens,
    };
  }
}

export const embeddingService = new EmbeddingService();