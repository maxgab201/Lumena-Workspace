import { create } from 'zustand';
import { ChatRepository } from '../repositories/chat.repository';
import type { ChatSession, ChatMessage, Role, ChatContext } from '../types/chat';
import { AIGateway } from '../lib/providers/AIGateway';
import { useHighlightStore } from './highlightStore';
import { useViewerStore } from './viewerStore';
import { useWorkspaceStore } from './workspaceStore';
import { usePageRegistryStore } from './pageRegistryStore';
import { supabase } from '../lib/supabase';

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
  selectedModel: 'gemini-flash-latest',
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
    let { activeSessionId, selectedModel } = get();

    // Fallback: If no active session, attempt to initialize from current document
    if (!activeSessionId) {
      const docId = useViewerStore.getState().documentId;
      const wsId = useWorkspaceStore.getState().activeWorkspace?.id;
      if (docId && wsId) {
        try {
          const session = await ChatRepository.getOrCreateSession(docId, wsId);
          activeSessionId = session.id;
          set((state) => ({
            sessions: { ...state.sessions, [docId]: session },
            activeSessionId: session.id,
          }));
        } catch {
          // Fall through
        }
      }
    }

    if (!activeSessionId) {
      console.warn('[ChatStore] No active session available for message');
      return;
    }

    set({ isGenerating: true });

    let assistantMsgId: string | null = null;
    try {
      // 1. Persist user message
      const userMsg = await ChatRepository.addMessage(activeSessionId, 'user' as Role, text);

      // 2. Persist empty assistant message placeholder
      const assistantMsg = await ChatRepository.addMessage(activeSessionId, 'assistant' as Role, '');
      assistantMsgId = assistantMsg.id;

      // 3. Build context for the AI (including RAG retrieval)
      const context = await buildChatContext(text);

      // 4. Update local state immediately with citations
      set((state) => ({
        messages: {
          ...state.messages,
          [activeSessionId!]: [
            ...(state.messages[activeSessionId!] ?? []),
            userMsg,
            { ...assistantMsg, citations: context.ragChunks },
          ],
        },
      }));

      // 5. Stream AI response
      let accumulated = '';
      await AIGateway.generateStream(text, context, selectedModel, (chunk) => {
        accumulated += chunk;
        get().appendStreamChunk(assistantMsg.id, chunk);
      });

      // 6. Persist final assistant content to DB
      await ChatRepository.updateMessage(assistantMsg.id, accumulated);
    } catch (err: any) {
      console.error('[ChatStore] Error sending message:', err);

      let userFacingError = 'AI service is not configured for this environment or is currently unavailable.';
      if (err?.status === 402 || err?.message?.toLowerCase().includes('credit')) {
        userFacingError = 'You do not have enough AI credits to perform this request. Please upgrade to Pro or buy additional credits in Billing.';
      } else if (err?.message?.includes('GEMINI_API_KEY') || err?.message?.includes('API key')) {
        userFacingError = 'AI service is not configured for this environment.';
      }

      if (assistantMsgId && activeSessionId) {
        // Replace empty assistant message with user-friendly error note
        set((state) => ({
          messages: {
            ...state.messages,
            [activeSessionId!]: (state.messages[activeSessionId!] ?? []).map((m) =>
              m.id === assistantMsgId ? { ...m, content: `⚠️ ${userFacingError}` } : m
            ),
          },
        }));
        await ChatRepository.updateMessage(assistantMsgId, `⚠️ ${userFacingError}`).catch(() => undefined);
      }
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
    selectedModel: 'gemini-flash-latest',
    isGenerating: false,
    isLoadingSession: false,
  }),

  getActiveMessages: () => {
    const { activeSessionId, messages } = get();
    if (!activeSessionId) return [];
    return messages[activeSessionId] ?? [];
  },
}));

// Build chat context for AI
async function buildChatContext(userQuery?: string): Promise<ChatContext> {
  const viewerStore = useViewerStore.getState();
  const highlightStore = useHighlightStore.getState();
  const chatStore = useChatStore.getState();
  const workspaceStore = useWorkspaceStore.getState();

  const documentId = viewerStore.documentId;
  const currentPage = viewerStore.currentPage;

  // Get highlights for current document
  const highlights = documentId ? highlightStore.getHighlightsForDocument(documentId) : [];

  // Get active highlights for current page
  const activeHighlights = highlights
    .filter(h => h.page_index === currentPage - 1)
    .map(h => ({
      text: h.text,
      page: h.page_index + 1,
      color: h.color,
      category: h.category_id ?? undefined,
      note: h.note ?? undefined,
    }));

  // Get all highlights for the document
  const allHighlights = highlights.map(h => ({
    text: h.text,
    page: h.page_index + 1,
    color: h.color,
    category: h.category_id ?? undefined,
    note: h.note ?? undefined,
  }));

  // Get chat history for context (last 10 messages)
  const activeSessionId = chatStore.activeSessionId;
  const messages = activeSessionId ? chatStore.messages[activeSessionId] ?? [] : [];
  const recentMessages = messages.slice(-10).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const activeWorkspace = workspaceStore.activeWorkspace;
  const activeSession = activeSessionId ? chatStore.sessions[activeSessionId] : undefined;
  const workspaceId = activeWorkspace?.id ?? activeSession?.workspace_id;

  // Get selected text from viewer
  const selectedText = viewerStore.selectedText ?? '';
  const selectedTextPageIndex = viewerStore.selectedTextPageIndex ?? -1;

  // Get document text for current page (from page registry)
  const pageRegistry = usePageRegistryStore.getState();
  const currentPageData = pageRegistry.pages[currentPage - 1];
  const documentText = currentPageData?.ocrData?.data?.text || '';

  // Get selection rects from viewer
  const selectionRects = viewerStore.selectionRects ?? [];

  // ==========================================
  // RAG RETRIEVAL: Get relevant chunks from vector search
  // ==========================================
  let ragChunks: Array<{
    document_id: string;
    document_name: string;
    page_number: number;
    chunk_index: number;
    chunk_text: string;
    similarity: number;
    match_type: string;
  }> = [];

  if (userQuery && documentId && workspaceId) {
    try {
      ragChunks = await retrieveRAGChunks(userQuery, workspaceId, documentId);
    } catch (err) {
      console.error('[ChatStore] RAG retrieval failed:', err);
      // Continue without RAG context - don't break chat
    }
  }

  return {
    documentId: documentId ?? undefined,
    workspaceId,
    currentPage,
    activeHighlights,
    recentMessages,
    documentName: viewerStore.documentId ?? undefined,
    workspaceName: activeWorkspace?.name,
    selectedText: selectedText || undefined,
    selectedTextPageIndex: selectedTextPageIndex >= 0 ? selectedTextPageIndex : undefined,
    documentText: documentText || undefined,
    allHighlights: allHighlights.length > 0 ? allHighlights : undefined,
    selectionRects: selectionRects.length > 0 ? selectionRects : undefined,
    // RAG retrieval results for context
    ragChunks: ragChunks.length > 0 ? ragChunks : undefined,
  };
}

// RAG Retrieval function - calls the rag-retrieve edge function
async function retrieveRAGChunks(
  query: string,
  workspaceId: string,
  documentId: string,
  limit: number = 5
): Promise<Array<{
  document_id: string;
  document_name: string;
  page_number: number;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
  match_type: string;
}>> {
  try {
    const session = await supabase.auth.getSession();
    const { data: { session: currentSession } } = session;

    if (!currentSession) {
      console.warn('[ChatStore] No active session for RAG retrieval');
      return [];
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({
        query,
        workspace_id: workspaceId,
        document_id: documentId,
        limit,
        similarity_threshold: 0.65,
        semantic_weight: 0.7,
        keyword_weight: 0.3,
      }),
    });

    if (!response.ok) {
      console.warn('[ChatStore] RAG retrieval failed:', response.status);
      return [];
    }

    const data = await response.json();
    return data.results?.map((r: any) => ({
      document_id: r.document_id,
      document_name: r.document_name,
      page_number: r.page_number,
      chunk_index: r.chunk_index,
      chunk_text: r.chunk_text,
      similarity: r.similarity,
      match_type: r.citation?.match_type || 'hybrid',
    })) || [];
  } catch (err) {
    console.error('[ChatStore] RAG retrieval error:', err);
    return [];
  }
}
