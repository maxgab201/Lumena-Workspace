import { supabase } from '../lib/supabase';
import type { ChatSession, ChatMessage, Role } from '../types/chat';

export const ChatRepository = {
  /**
   * Get an existing chat session for a document+user, or create one.
   * The UNIQUE constraint on (document_id, user_id) ensures idempotency.
   */
  async getOrCreateSession(
    documentId: string,
    workspaceId: string,
  ): Promise<ChatSession> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Try to find existing session
    const { data: existing, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) return existing as ChatSession;

    // Create a new session
    const { data: created, error: createError } = await supabase
      .from('chat_sessions')
      .insert({
        document_id: documentId,
        workspace_id: workspaceId,
        user_id: user.id,
      })
      .select()
      .single();

    if (createError) throw createError;
    return created as ChatSession;
  },

  /**
   * Fetch all messages for a session, ordered chronologically.
   */
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  },

  /**
   * Persist a new message and return the persisted row.
   */
  async addMessage(
    sessionId: string,
    role: Role,
    content: string,
    messageReferences?: Record<string, unknown> | Record<string, unknown>[],
  ): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ session_id: sessionId, role, content, message_references: messageReferences as unknown as null })
      .select()
      .single();

    if (error) throw error;
    return data as ChatMessage;
  },

  /**
   * Update an existing message (used to patch assistant content after streaming).
   */
  async updateMessage(
    messageId: string,
    content: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .update({ content })
      .eq('id', messageId);

    if (error) throw error;
  },

  /**
   * Delete all messages in a session (clear chat).
   */
  async clearSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId);

    if (error) throw error;
  },
};
