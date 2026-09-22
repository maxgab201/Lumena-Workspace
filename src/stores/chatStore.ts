import { create } from 'zustand';
import { ChatRepository } from '../repositories/chat.repository';
import type { ChatSession, ChatMessage, Role, ChatContext } from '../types/chat';
import { AIGateway } from '../lib/providers/AIGateway';
import { useHighlightStore } from './highlightStore';
import { useViewerStore } from './viewerStore';
import { useWorkspaceStore } from './workspaceStore';
import { usePageRegistryStore } from './pageRegistryStore';
import { supabase } from '../lib/supabase';
import { AiHighlightService } from '../lib/ai/AiHighlightService';
import { parseCreateHighlightsAction, type CreateHighlightsAction } from '../lib/chatActions';
import { highlightActionResultText, resolveChatLanguage, type ChatLanguage } from '../lib/chatLanguage';
import { extractPageReferenceRange, pageLabelFor, resolvePageRange } from '../lib/pageMapping';

export interface ChatActionRuntime {
  fileUrl?: string;
  documentId?: string | null;
  workspaceId?: string;
  currentPage?: number;
}

interface AuthorizedHighlightAction extends CreateHighlightsAction {
  model_id: string;
}

interface ChatStoreState {
  // Sessions keyed by document_id
  sessions: Record<string, ChatSession>;
  // Messages keyed by session_id
  messages: Record<string, ChatMessage[]>;
  activeSessionId: string | null;
  selectedModel: string;
  isGenerating: boolean;
  isLoadingSession: boolean;
  abortController: AbortController | null;

  // Actions
  loadSession: (documentId: string, workspaceId: string) => Promise<void>;
  sendMessage: (text: string, runtime?: ChatActionRuntime) => Promise<void>;
  stopGenerating: () => void;
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
  selectedModel: 'gemini-3.5-flash-lite',
  isGenerating: false,
  isLoadingSession: false,
  abortController: null,

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

  sendMessage: async (text, runtime) => {
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

      // Explicit highlight actions are parsed ONLY from the user's message.
      // Document/OCR/RAG content can never trigger this branch.
      const highlightAction = parseCreateHighlightsAction(text, context.currentPage, useViewerStore.getState().resolvePageReference);
      if (highlightAction) {
        const documentId = runtime?.documentId ?? context.documentId;
        const workspaceId = runtime?.workspaceId ?? context.workspaceId;
        const fileUrl = runtime?.fileUrl;
        if (!documentId || !workspaceId || !fileUrl) {
          throw new Error('The PDF viewer context is not ready for highlighting yet.');
        }

        const preferredHighlightModel = typeof window !== 'undefined'
          ? (window.localStorage.getItem('lumena.ai-highlight.model') || 'gemini-3.5-flash-lite')
          : 'gemini-3.5-flash-lite';

        const authorized = await authorizeCreateHighlightsAction(
          highlightAction,
          documentId,
          workspaceId,
          preferredHighlightModel,
        );

        const pdfResponse = await fetch(fileUrl);
        if (!pdfResponse.ok) throw new Error('Could not load the PDF for highlighting.');
        const blob = await pdfResponse.blob();

        const summary = await AiHighlightService.highlightDocument({
          file: blob,
          documentId,
          workspaceId,
          scope: authorized.scope === 'document'
            ? 'document'
            : authorized.scope === 'page_range'
              ? 'range'
              : 'page',
          pageNumber: authorized.scope === 'current_page'
            ? (authorized.page ?? runtime?.currentPage ?? context.currentPage)
            : undefined,
          pageNumbers: authorized.scope === 'page_range' ? authorized.pages : undefined,
          density: 'normal',
          modelId: authorized.model_id,
          instruction: authorized.instruction,
          replaceExisting: false,
        });

        const resultText = highlightActionResultText(
          (context.language ?? 'en') as ChatLanguage,
          summary.created,
          authorized.scope,
        );

        set((state) => ({
          messages: {
            ...state.messages,
            [activeSessionId!]: (state.messages[activeSessionId!] ?? []).map((m) =>
              m.id === assistantMsg.id ? { ...m, content: resultText } : m
            ),
          },
        }));
        await ChatRepository.updateMessage(assistantMsg.id, resultText);
        return;
      }

      // 5. Stream AI response (abortable via stopGenerating)
      const abortController = new AbortController();
      set({ abortController });
      let accumulated = '';
      try {
        await AIGateway.generateStream(text, context, selectedModel, (chunk) => {
          accumulated += chunk;
          get().appendStreamChunk(assistantMsg.id, chunk);
        }, abortController.signal);
      } catch (streamErr: any) {
        if (streamErr?.name === 'AbortError') {
          // User stopped generation — keep partial content as the final message
          if (!accumulated) {
            accumulated = '⚠️ Generation stopped.';
          }
        } else {
          throw streamErr;
        }
      }

      // 6. Persist final assistant content to DB
      await ChatRepository.updateMessage(assistantMsg.id, accumulated);
    } catch (err: any) {
      console.error('[ChatStore] Error sending message:', err);

      let userFacingError = 'The AI service is temporarily unavailable. Please try again in a moment.';
      if (err?.status === 429) {
        userFacingError = 'The AI service is at capacity right now. Try again in a few seconds.';
      } else if (err?.name === 'AbortError') {
        userFacingError = 'Generation stopped.';
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
      set({ isGenerating: false, abortController: null });
    }
  },

  stopGenerating: () => {
    const { abortController } = get();
    abortController?.abort();
    set({ abortController: null });
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
    selectedModel: 'gemini-3.5-flash-lite',
    isGenerating: false,
    isLoadingSession: false,
    abortController: null,
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
  const currentPageLabel = viewerStore.getPageLabel(currentPage);

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
      source: h.source ?? 'manual',
    }));

  // Get all highlights for the document
  const allHighlights = highlights.map(h => ({
    text: h.text,
    page: h.page_index + 1,
    color: h.color,
    category: h.category_id ?? undefined,
    note: h.note ?? undefined,
    source: h.source ?? 'manual',
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
  let workspaceId = activeWorkspace?.id ?? activeSession?.workspace_id;

  // Direct navigation to a viewer route can beat workspace-store hydration.
  // The document is the source of truth for its workspace — resolve it there
  // so chat (and RAG) never run with a missing or fake workspace id.
  if (!workspaceId && documentId) {
    try {
      const { data: docRow } = await supabase
        .from('documents')
        .select('workspace_id')
        .eq('id', documentId)
        .maybeSingle();
      if (docRow?.workspace_id) workspaceId = docRow.workspace_id;
    } catch {
      // Non-fatal: chat still works, backend will surface a clear error
    }
  }

  // Get selected text from viewer
  const selectedText = viewerStore.selectedText ?? '';
  const selectedTextPageIndex = viewerStore.selectedTextPageIndex ?? -1;

  // Get document text for current page — unified native + OCR. Native text
  // comes from document_page_texts (chained extraction checkpoint); OCR text
  // from the page registry. Scanned and native pages are indistinguishable
  // to the model.
  const pageRegistry = usePageRegistryStore.getState();
  const currentPageData = pageRegistry.pages[currentPage - 1];
  let documentText = currentPageData?.ocrData?.data?.text || '';

  if (!documentText && documentId) {
    try {
      const { data: pageTextRow } = await supabase
        .from('document_page_texts')
        .select('page_text')
        .eq('document_id', documentId)
        .eq('page_number', currentPage)
        .maybeSingle();
      if (pageTextRow?.page_text) documentText = pageTextRow.page_text;
    } catch {
      // Non-fatal: chat works without page text
    }
  }

  // Resolve explicit logical page references (e.g. "pages 50-65" or "páginas iv-vii")
  // into physical PDF indexes, then attach the actual page text. This prevents
  // the model from confusing printed book numbering with PDF indexes.
  let requestedPages: Array<{ physicalPage: number; logicalLabel: string; text: string }> = [];
  if (userQuery && documentId) {
    const requestedRange = extractPageReferenceRange(userQuery);
    const resolvedRange = requestedRange
      ? resolvePageRange(viewerStore.pageLabels, requestedRange, 25)
      : null;

    if (resolvedRange) {
      try {
        const { data: rows } = await supabase
          .from('document_page_texts')
          .select('page_number,page_text')
          .eq('document_id', documentId)
          .in('page_number', resolvedRange.pages);

        const byPage = new Map((rows ?? []).map((row) => [row.page_number, row.page_text]));
        requestedPages = resolvedRange.pages
          .map((physicalPage) => {
            const registryText = pageRegistry.pages[physicalPage - 1]?.ocrData?.data?.text || '';
            const text = registryText || byPage.get(physicalPage) || '';
            return {
              physicalPage,
              logicalLabel: pageLabelFor(viewerStore.pageLabels, physicalPage),
              text,
            };
          })
          .filter((page) => page.text.trim().length > 0);
      } catch (error) {
        console.warn('[ChatStore] Could not load explicitly requested logical pages:', error);
      }
    }
  }

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

  const language = resolveChatLanguage({
    recentUserMessages: [
      ...recentMessages.filter((m) => m.role === 'user').map((m) => m.content),
      ...(userQuery ? [userQuery] : []),
    ],
    currentPageText: documentText,
    documentText,
    locale: typeof navigator !== 'undefined' ? navigator.language : 'en',
  });

  return {
    documentId: documentId ?? undefined,
    workspaceId,
    currentPage,
    currentPageLabel,
    requestedPages: requestedPages.length > 0 ? requestedPages : undefined,
    activeHighlights,
    recentMessages,
    documentName: viewerStore.documentId ?? undefined,
    workspaceName: activeWorkspace?.name,
    selectedText: selectedText || undefined,
    selectedTextPageIndex: selectedTextPageIndex >= 0 ? selectedTextPageIndex : undefined,
    documentText: documentText || undefined,
    allHighlights: allHighlights.length > 0 ? allHighlights : undefined,
    selectionRects: selectionRects.length > 0 ? selectionRects : undefined,
    language,
    selectedModel: chatStore.selectedModel,
    // RAG retrieval results for context
    ragChunks: ragChunks.length > 0 ? ragChunks : undefined,
  };
}

async function authorizeCreateHighlightsAction(
  action: CreateHighlightsAction,
  documentId: string,
  workspaceId: string,
  modelId: string,
): Promise<AuthorizedHighlightAction> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Your session expired. Sign in again.');

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-highlights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      document_id: documentId,
      workspace_id: workspaceId,
      scope: action.scope,
      page: action.page,
      pages: action.pages,
      instruction: action.instruction,
      model_id: modelId,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.action) {
    const error = new Error(data?.error || `Highlight action rejected (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return data.action as AuthorizedHighlightAction;
}

/**
 * Ask about the current page without RAG — the page text is the context.
 * Used by the "Ask about this page" action where the query clearly refers
 * to what the user is looking at.
 */
export async function askAboutPage(question: string): Promise<void> {
  const store = useChatStore.getState();
  await store.sendMessage(question);
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
