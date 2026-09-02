const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface AIProviderResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIProviderStreamResult {
  text: string;
  done: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Gemini provider using the REST API directly (v1beta).
 * Model codes are passed through as-is, e.g. 'gemini-2.5-flash'.
 */
const RETRYABLE_STATUS = new Set([429, 500, 503]);

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
    // Exponential backoff: 2s, 4s
    await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, i)));
  }
  return lastRes!;
}

/**
 * Gemini provider using the REST API directly (v1beta).
 * Model codes are passed through as-is, e.g. 'gemini-2.5-flash'.
 */
export class GeminiProvider {
  readonly id = "google";
  private apiKey: string;

  constructor() {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    this.apiKey = apiKey;
  }

  async generate(modelCode: string, prompt: string): Promise<AIProviderResult> {
    const res = await fetchWithRetry(
      `${GEMINI_API_BASE}/models/${modelCode}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini generate failed (${res.status}): ${errText.slice(0, 300)}`);
    }

    const json = await res.json();
    const candidate = json.candidates?.[0];
    const text: string =
      candidate?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";

    return {
      text,
      usage: {
        inputTokens: json.usageMetadata?.promptTokenCount ?? Math.ceil(prompt.length / 4),
        outputTokens:
          json.usageMetadata?.candidatesTokenCount ??
          (json.usageMetadata?.totalTokenCount ?? Math.max(1, Math.ceil(text.length / 4))),
      },
    };
  }

  async *generateStream(
    modelCode: string,
    prompt: string,
  ): AsyncIterable<AIProviderStreamResult> {
    const res = await fetchWithRetry(
      `${GEMINI_API_BASE}/models/${modelCode}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini stream failed (${res.status}): ${errText.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastUsage: { inputTokens: number; outputTokens: number } | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const json = JSON.parse(line.slice(6));
          const text: string =
            json.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
          if (json.usageMetadata) {
            lastUsage = {
              inputTokens:
                json.usageMetadata.promptTokenCount ?? lastUsage?.inputTokens ?? 0,
              outputTokens:
                json.usageMetadata.candidatesTokenCount ??
                json.usageMetadata.totalTokenCount ??
                lastUsage?.outputTokens ??
                0,
            };
          }
          if (text) {
            yield { text, done: false, usage: lastUsage };
          }
        } catch {
          // skip malformed SSE fragments
        }
      }
    }

    yield { text: "", done: true, usage: lastUsage };
  }
}
