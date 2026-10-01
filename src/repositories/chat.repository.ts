import { supabase } from '../lib/supabase';
import type { ChatSession, ChatMessage, Role } from '../types/chat';

// Loads still in flight, so two components asking for the same session at the same moment share
// one lookup/insert instead of racing each other (production: 409 on POST /chat_sessions
// every time the reader opened).
const sessionLoads = new Map<string, Promise<ChatSession>>();

async function loadOrCreateSession(documentId: string, workspaceId: string): Promise<ChatSession> {
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

  if (createError) {
    // Two callers can get past the lookup above at the same moment (the chat sidebar loads
    // the session while a send initialises one). The UNIQUE (document_id, user_id)
    // constraint rejects the loser with 23505, but by then the session exists: read it
    // instead of failing the load (production: 409 on POST /chat_sessions).
    if (createError.code === '23505') {
      const { data: raced, error: refetchError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (refetchError) throw refetchError;
      if (raced) return raced as ChatSession;
    }
    throw createError;
  }
  return created as ChatSession;
}

export const ChatRepository = {
  /**
   * Get an existing chat session for a document+user, or create one.
   * The UNIQUE constraint on (document_id, user_id) ensures idempotency.
   */
  getOrCreateSession(documentId: string, workspaceId: string): Promise<ChatSession> {
    const key = `${documentId}:${workspaceId}`;
    const pending = sessionLoads.get(key);
    if (pending) return pending;
    const load = loadOrCreateSession(documentId, workspaceId).finally(() => sessionLoads.delete(key));
    sessionLoads.set(key, load);
    return load;
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
