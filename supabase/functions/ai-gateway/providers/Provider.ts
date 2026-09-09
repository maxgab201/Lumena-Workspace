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

export interface AIProvider {
  /**
   * Identifies the provider (e.g. 'google', 'openai')
   */
  readonly id: string;

  /**
   * Generates content from the provider using a specific model.
   */
  generate(modelCode: string, prompt: string): Promise<AIProviderResult>;

  /**
   * Generates content from the provider with streaming support.
   * Returns an async iterator yielding chunks of text.
   */
  generateStream?(modelCode: string, prompt: string): AsyncIterable<AIProviderStreamResult>;
}
