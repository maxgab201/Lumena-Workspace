import type { AIProviderOptions, AIProviderResult, AIProviderStreamResult } from './Provider.ts';

const RETRYABLE_STATUS = new Set([429, 500, 503, 502, 504]);

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastRes: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, init);
    if (res.ok || !RETRYABLE_STATUS.has(res.status)) return res;
    lastRes = res;
    await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, i)));
  }
  return lastRes!;
}

export class OpenRouterProvider implements AIProvider {
  readonly id = 'openrouter';
  private apiKey: string;
  private chatModel: string;
  private fallbackModels: string[];

  constructor() {
    const key = Deno.env.get('OPENROUTER_API_KEY') ?? '';
    if (!key) console.warn('[OpenRouterProvider] OPENROUTER_API_KEY missing — OpenRouter unavailable');
    this.apiKey = key;

    this.chatModel = Deno.env.get('OPENROUTER_CHAT_MODEL') || 'nex-agi/nex-n2.5-pro:free';
    const fallbackRaw = Deno.env.get('OPENROUTER_FALLBACK_MODELS') || '';
    this.fallbackModels = fallbackRaw.split(',').map((m) => m.trim()).filter((m) => !!m);
  }

  private baseUrl = 'https://openrouter.ai/api/v1';

  private buildHeaders(stream?: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://lumena-workspace.vercel.app',
      'X-Title': 'Lumena Workspace',
    };
    if (stream) {
      headers['Accept'] = 'text/event-stream';
    }
    return headers;
  }

  async generate(
    modelCode: string,
    prompt: string,
    options?: AIProviderOptions,
  ): Promise<AIProviderResult> {
    const model = this.chatModel || modelCode || 'meta-llama/llama-3.1-8b-instruct:free';
    const res = await fetchWithRetry(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model,
          messages: [
            ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          max_tokens: 2048,
          temperature: 0.7,
        }),
      },
      3,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenRouter generate failed (${res.status}): ${errText.slice(0, 300)}`);
    }

    const json = await res.json();
    const text: string =
      json.choices?.[0]?.message?.content ?? '';
    return {
      text,
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4),
        outputTokens: json.usage?.completion_tokens ?? Math.max(1, Math.ceil(text.length / 4)),
      },
    };
  }

  async *generateStream(
    modelCode: string,
    prompt: string,
    options?: AIProviderOptions,
  ): AsyncIterable<AIProviderStreamResult> {
    const model = this.chatModel || modelCode || 'meta-llama/llama-3.1-8b-instruct:free';
    const res = await fetchWithRetry(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: this.buildHeaders(true),
        body: JSON.stringify({
          model,
          messages: [
            ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          stream: true,
          max_tokens: 2048,
          temperature: 0.7,
        }),
      },
      3,
    );

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenRouter stream failed (${res.status}): ${errText.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastUsage = { inputTokens: 0, outputTokens: 0 };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            yield { text: '', done: true, usage: lastUsage };
            return;
          }
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta;
            const chunkText = delta?.content ?? '';
            const finishReason = delta?.finish_reason ?? null;
            if (finishReason) {
              yield { text: chunkText || '', done: true, usage: lastUsage };
              return;
            }
            if (chunkText) {
              yield { text: chunkText, done: false, usage: lastUsage };
            }
            if (data.usage) {
              lastUsage = {
                inputTokens: data.usage.prompt_tokens ?? lastUsage.inputTokens,
                outputTokens: data.usage.completion_tokens ?? lastUsage.outputTokens,
              };
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
