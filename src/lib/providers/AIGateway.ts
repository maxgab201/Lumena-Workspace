import { useBillingStore } from '../../stores/billingStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { supabase } from '../supabase';

export class AIGateway {
  /**
   * Generates a text response based on a prompt.
   * This now routes securely through the Supabase Edge Function 'ai-gateway'
   * to ensure accurate cost metering, credit reservation, and consumption.
   */
  static async generate(prompt: string, context?: any, modelCode: string = 'gemini-flash-latest'): Promise<{ text: string, usage?: any }> {
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
          model_code: modelCode,
          document_id: context?.documentId || null,
          context: context || null
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
   * Real streaming implementation using fetch with ReadableStream.
   * Connects to the Edge Function via SSE and yields chunks as they arrive.
   */
  static async generateStream(
    prompt: string,
    context: any | undefined,
    modelCode: string = 'gemini-flash-latest',
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<{ text: string; usage?: any }> {
    // Viewer routes can be opened directly, before the dashboard has hydrated
    // the workspace store. The chat context already carries the session's
    // workspace, so use it as the authoritative fallback for streaming.
    const workspaceId = useWorkspaceStore.getState().activeWorkspace?.id ?? context?.workspaceId ?? context?.workspace_id ?? 'workspace-1';

    if (!workspaceId) {
      throw new Error('No active workspace selected.');
    }

    const session = supabase.auth.getSession();
    const { data: { session: currentSession } } = await session;

    if (!currentSession) {
      throw new Error('No active session');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({
        prompt,
        workspace_id: workspaceId,
        action_type: 'chat',
        model_code: modelCode,
        document_id: context?.documentId || null,
        context: context || null,
        stream: true
      }),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || `HTTP ${response.status}`);
      (error as any).status = response.status;
      if (response.status === 402) {
        (error as any).status = 402;
      }
      throw error;
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let accumulatedUsage: any = null;
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE format
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                accumulatedText += data.chunk;
                onChunk(data.chunk);
              }
              if (data.usage) {
                accumulatedUsage = data.usage;
              }
              if (data.done) {
                return { text: accumulatedText, usage: accumulatedUsage };
              }
            } catch {
              // Ignore parse errors for malformed chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { text: accumulatedText, usage: accumulatedUsage };
  }
}