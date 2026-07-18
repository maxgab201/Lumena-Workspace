export interface AIProviderResult {
  text: string;
  usage: {
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
}
