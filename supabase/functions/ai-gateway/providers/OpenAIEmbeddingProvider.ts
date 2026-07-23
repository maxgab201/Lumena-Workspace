/**
 * OpenAIEmbeddingProvider — Server-side OpenAI text-embedding-3-small implementation.
 */

import type { EmbeddingProvider, EmbeddingProviderResult } from "./EmbeddingProvider.ts"

const EMBEDDING_URL = "https://api.openai.com/v1/embeddings"
const MODEL = "text-embedding-3-small"
const DIMENSIONS = 1536

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string

  constructor() {
    this.apiKey = Deno.env.get("OPENAI_API_KEY") ?? ""
  }

  async embed(texts: string[]): Promise<EmbeddingProviderResult> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY not configured")
    }

    const response = await fetch(EMBEDDING_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: texts,
        dimensions: DIMENSIONS,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`OpenAI embedding error: ${response.status} ${body}`)
    }

    const result = await response.json()

    return {
      embeddings: result.data.map((item: { embedding: number[] }) => item.embedding),
      totalTokens: result.usage?.total_tokens ?? 0,
      model: MODEL,
    }
  }

  getId(): string {
    return "openai"
  }

  getModelId(): string {
    return MODEL
  }

  getMaxBatchSize(): number {
    return 2048
  }
}
