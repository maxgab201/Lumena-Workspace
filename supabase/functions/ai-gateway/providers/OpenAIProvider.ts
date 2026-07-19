import type { AIProvider, AIProviderResult } from './Provider.ts'

/**
 * Skeleton implementation for OpenAI.
 * To activate, `openai` package would be imported, and `OPENAI_API_KEY` checked.
 */
export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  private apiKey: string;

  constructor() {
    const key = Deno.env.get('OPENAI_API_KEY')
    if (!key) throw new Error('OPENAI_API_KEY is not configured.')
    this.apiKey = key
  }

  async generate(_modelCode: string, _prompt: string): Promise<AIProviderResult> {
    // In a real implementation we would use:
    // const response = await fetch('https://api.openai.com/v1/chat/completions', ...)

    // For Phase 17 proof of concept we simulate an error if someone tries to use it without implementation,
    // or just return a dummy if we are strictly testing fallback.
    // We throw to allow the router to fall back (or fail).
    throw new Error('OpenAIProvider generate logic not fully implemented yet.')
  }
}
