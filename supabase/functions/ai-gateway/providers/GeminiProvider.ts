import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.2.1"
import type { AIProvider, AIProviderResult, AIProviderStreamResult } from './Provider.ts'

export class GeminiProvider implements AIProvider {
  readonly id = 'google';
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.')
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  async generate(modelCode: string, prompt: string): Promise<AIProviderResult> {
    const model = this.genAI.getGenerativeModel({ model: modelCode })

    // Rough estimation fallback in case SDK doesn't return usage metadata
    const estimatedInputTokens = Math.max(10, Math.ceil(prompt.length / 4))

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    let inputTokens = estimatedInputTokens
    let outputTokens = Math.max(1, Math.ceil(text.length / 4))

    if (response.usageMetadata) {
      inputTokens = response.usageMetadata.promptTokenCount || inputTokens
      outputTokens = response.usageMetadata.candidatesTokenCount || outputTokens
    }

    return {
      text,
      usage: { inputTokens, outputTokens }
    }
  }

  async *generateStream(modelCode: string, prompt: string): AsyncIterable<AIProviderStreamResult> {
    const model = this.genAI.getGenerativeModel({ model: modelCode })

    let outputTokens = 0

    // Rough estimation fallback
    const estimatedInputTokens = Math.max(10, Math.ceil(prompt.length / 4))

    const result = await model.generateContentStream(prompt)

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) {
        outputTokens = Math.max(1, Math.ceil(text.length / 4))
        yield {
          text,
          done: false,
          usage: {
            inputTokens: estimatedInputTokens,
            outputTokens
          }
        }
      }
    }

    // Final chunk with full usage metadata
    const finalResponse = await result.response
    let inputTokensFinal = estimatedInputTokens
    let outputTokensFinal = outputTokens

    if (finalResponse.usageMetadata) {
      inputTokensFinal = finalResponse.usageMetadata.promptTokenCount || estimatedInputTokens
      outputTokensFinal = finalResponse.usageMetadata.candidatesTokenCount || outputTokens
    }

    yield {
      text: '',
      done: true,
      usage: {
        inputTokens: inputTokensFinal,
        outputTokens: outputTokensFinal
      }
    }
  }
}
