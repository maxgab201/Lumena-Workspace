import { create } from 'zustand';
import { ChatRepository } from '../repositories/chat.repository';
import type { ChatSession, ChatMessage, Role } from '../types/chat';
import { AIGateway } from '../lib/providers/AIGateway';

interface ChatStoreState {
  // Sessions keyed by document_id
  sessions: Record<string, ChatSession>;
  // Messages keyed by session_id
  messages: Record<string, ChatMessage[]>;
  activeSessionId: string | null;
  selectedModel: string;
  isGenerating: boolean;
  isLoadingSession: boolean;

  // Actions
  loadSession: (documentId: string, workspaceId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  setSelectedModel: (modelCode: string) => void;
  appendStreamChunk: (messageId: string, chunk: string) => void;
  clearSession: () => Promise<void>;
  setIsGenerating: (isGenerating: boolean) => void;
  reset: () => void;

  // Selectors
  getActiveMessages: () => ChatMessage[];
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  sessions: {},
  messages: {},
  activeSessionId: null,
  selectedModel: '',
  isGenerating: false,
  isLoadingSession: false,

  loadSession: async (documentId, workspaceId) => {
    set({ isLoadingSession: true });
    try {
      const session = await ChatRepository.getOrCreateSession(documentId, workspaceId);
      const msgs = await ChatRepository.getMessages(session.id);

      set((state) => ({
        sessions: { ...state.sessions, [documentId]: session },
        messages: { ...state.messages, [session.id]: msgs },
        activeSessionId: session.id,
        isLoadingSession: false,
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to load session:', err);
      set({ isLoadingSession: false });
    }
  },

  sendMessage: async (text) => {
    const { activeSessionId, selectedModel } = get();
    if (!activeSessionId) {
      console.error('[ChatStore] No active session');
      return;
    }

    set({ isGenerating: true });

    try {
      // 1. Persist user message
      const userMsg = await ChatRepository.addMessage(activeSessionId, 'user' as Role, text);

      // 2. Persist empty assistant message placeholder
      const assistantMsg = await ChatRepository.addMessage(activeSessionId, 'assistant' as Role, '');

      // 3. Update local state immediately (optimistic)
      set((state) => ({
        messages: {
          ...state.messages,
          [activeSessionId]: [
            ...(state.messages[activeSessionId] ?? []),
            userMsg,
            assistantMsg,
          ],
        },
      }));

      // 4. Stream AI response
      let accumulated = '';
      await AIGateway.generateStream(text, undefined, selectedModel, (chunk) => {
        accumulated += chunk;
        get().appendStreamChunk(assistantMsg.id, chunk);
      });

      // 5. Persist final assistant content to DB
      await ChatRepository.updateMessage(assistantMsg.id, accumulated);
    } catch (err) {
      console.error('[ChatStore] Error sending message:', err);
      // Append error note to assistant message in local state
    } finally {
      set({ isGenerating: false });
    }
  },

  appendStreamChunk: (messageId, chunk) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    set((state) => ({
      messages: {
        ...state.messages,
        [activeSessionId]: (state.messages[activeSessionId] ?? []).map((m) =>
          m.id === messageId
            ? { ...m, content: m.content + chunk }
            : m,
        ),
      },
    }));
  },

  clearSession: async () => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    try {
      await ChatRepository.clearSession(activeSessionId);
      set((state) => ({
        messages: { ...state.messages, [activeSessionId]: [] },
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to clear session:', err);
    }
  },

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  setSelectedModel: (modelCode) => set({ selectedModel: modelCode }),

  reset: () => set({
    sessions: {},
    messages: {},
    activeSessionId: null,
    selectedModel: '',
    isGenerating: false,
    isLoadingSession: false,
  }),

  getActiveMessages: () => {
    const { activeSessionId, messages } = get();
    if (!activeSessionId) return [];
    return messages[activeSessionId] ?? [];
  },
}));
