import { useBillingStore } from '../../stores/billingStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { supabase } from '../supabase';

export class AIGateway {
  /**
   * Generates a text response based on a prompt.
   * This now routes securely through the Supabase Edge Function 'ai-gateway'
   * to ensure accurate cost metering, credit reservation, and consumption.
   */
  static async generate(prompt: string, context?: any): Promise<{ text: string, usage?: any }> {
    const account = useBillingStore.getState().account;
    const workspaceId = useWorkspaceStore.getState().activeWorkspace?.id;

    if (!workspaceId) {
      throw new Error('No active workspace selected.');
    }

    if (!account || account.available <= 0) {
      throw new Error('Insufficient credits. Please upgrade your plan or purchase more credits.');
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-gateway', {
        body: {
          prompt,
          workspace_id: workspaceId,
          action_type: 'chat',
          model_code: 'gemini-1.5-flash',
          document_id: context?.documentId || null
        }
      });

      if (error) {
        throw new Error(error.message || 'Error generating AI response');
      }

      if (data.error) {
        if (data.status === 402) {
          throw new Error('Insufficient credits for this operation.');
        }
        throw new Error(data.error);
      }

      // Refresh billing data to reflect new account balances after consumption
      useBillingStore.getState().fetchBillingData();

      return {
        text: data.text,
        usage: data.usage
      };
    } catch (error) {
      console.error('[AIGateway] Backend generation failed:', error);
      throw error;
    }
  }

  /**
   * Stub for streaming. 
   * In a full implementation, we'd use native fetch to handle the ReadableStream 
   * returned by the Edge Function, or standard Edge Function streaming responses.
   * For Phase 16, we default to the synchronous metering call and mock the stream chunks.
   */
  static async generateStream(
    prompt: string, 
    context: any | undefined, 
    onChunk: (chunk: string) => void
  ): Promise<string> {
    // For now, we perform the synchronous call to guarantee metering,
    // and then mock the streaming behavior to the UI.
    const result = await this.generate(prompt, context);
    
    // Simulate streaming the result text
    const text = result.text;
    const chunkSize = 10;
    
    for (let i = 0; i < text.length; i += chunkSize) {
      onChunk(text.substring(i, i + chunkSize));
      // Small delay to simulate network streaming
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    return text;
  }
}
