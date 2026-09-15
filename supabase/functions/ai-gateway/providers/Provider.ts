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

/** Optional per-request generation settings passed through to the provider. */
export interface AIProviderOptions {
  /** System-level instruction. Providers map this to their native mechanism. */
  systemPrompt?: string;
}

export interface AIProvider {
  /**
   * Identifies the provider (e.g. 'google', 'openai')
   */
  readonly id: string;

  /**
   * Generates content from the provider using a specific model.
   */
  generate(modelCode: string, prompt: string, options?: AIProviderOptions): Promise<AIProviderResult>;

  /**
   * Generates content from the provider with streaming support.
   * Returns an async iterator yielding chunks of text.
   */
  generateStream?(modelCode: string, prompt: string, options?: AIProviderOptions): AsyncIterable<AIProviderStreamResult>;
}
