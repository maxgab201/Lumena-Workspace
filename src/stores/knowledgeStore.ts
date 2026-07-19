import { create } from 'zustand';
import { KnowledgeRepository } from '../repositories/knowledge.repository';
import type {
  Flashcard,
  GlossaryTerm,
  MindMapNode,
  TimelineEvent,
} from '../types/knowledge';

interface KnowledgeStoreState {
  // All keyed by document_id
  flashcards: Record<string, Flashcard[]>;
  glossary: Record<string, GlossaryTerm[]>;
  mindMapNodes: Record<string, MindMapNode[]>;
  timelineEvents: Record<string, TimelineEvent[]>;
  isStudyModeActive: boolean;
  isLoading: boolean;

  // Batch load for a document (called by Viewer on open)
  loadKnowledge: (documentId: string) => Promise<void>;

  // Flashcard actions
  addFlashcard: (
    documentId: string,
    workspaceId: string,
    card: Pick<Flashcard, 'front' | 'back' | 'page_number'>,
  ) => Promise<void>;
  deleteFlashcard: (id: string, documentId: string) => Promise<void>;

  // Glossary actions
  addGlossaryTerm: (
    documentId: string,
    workspaceId: string,
    term: Pick<GlossaryTerm, 'term' | 'definition' | 'page_number'>,
  ) => Promise<void>;
  deleteGlossaryTerm: (id: string, documentId: string) => Promise<void>;

  // Mind Map actions
  addMindMapNode: (
    documentId: string,
    workspaceId: string,
    node: Pick<MindMapNode, 'label' | 'parent_id' | 'position_x' | 'position_y'>,
  ) => Promise<void>;
  deleteMindMapNode: (id: string, documentId: string) => Promise<void>;

  // Timeline actions
  addTimelineEvent: (
    documentId: string,
    workspaceId: string,
    event: Pick<TimelineEvent, 'date_str' | 'description' | 'page_number'>,
  ) => Promise<void>;
  deleteTimelineEvent: (id: string, documentId: string) => Promise<void>;

  setStudyMode: (active: boolean) => void;

  // AI Generation actions
  isGenerating: boolean;
  generationError: string | null;
  generateFlashcards: (documentId: string, workspaceId: string) => Promise<void>;
  generateGlossary: (documentId: string, workspaceId: string) => Promise<void>;
  generateMindMap: (documentId: string, workspaceId: string) => Promise<void>;
}

export const useKnowledgeStore = create<KnowledgeStoreState>((set) => ({
  flashcards: {},
  glossary: {},
  mindMapNodes: {},
  timelineEvents: {},
  isStudyModeActive: false,
  isLoading: false,
  isGenerating: false,
  generationError: null,

  loadKnowledge: async (documentId) => {
    set({ isLoading: true });
    try {
      const { flashcards, glossaryTerms, mindMapNodes, timelineEvents } =
        await KnowledgeRepository.loadAllForDocument(documentId);

      set((state) => ({
        flashcards: { ...state.flashcards, [documentId]: flashcards },
        glossary: { ...state.glossary, [documentId]: glossaryTerms },
        mindMapNodes: { ...state.mindMapNodes, [documentId]: mindMapNodes },
        timelineEvents: { ...state.timelineEvents, [documentId]: timelineEvents },
        isLoading: false,
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to load knowledge:', err);
      set({ isLoading: false });
    }
  },

  // --- Flashcards ---
  addFlashcard: async (documentId, workspaceId, cardData) => {
    try {
      const created = await KnowledgeRepository.addFlashcard({
        document_id: documentId,
        workspace_id: workspaceId,
        ...cardData,
      });
      set((state) => ({
        flashcards: {
          ...state.flashcards,
          [documentId]: [...(state.flashcards[documentId] ?? []), created],
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to add flashcard:', err);
    }
  },

  deleteFlashcard: async (id, documentId) => {
    try {
      await KnowledgeRepository.deleteFlashcard(id);
      set((state) => ({
        flashcards: {
          ...state.flashcards,
          [documentId]: (state.flashcards[documentId] ?? []).filter((c) => c.id !== id),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to delete flashcard:', err);
    }
  },

  // --- Glossary ---
  addGlossaryTerm: async (documentId, workspaceId, termData) => {
    try {
      const created = await KnowledgeRepository.addGlossaryTerm({
        document_id: documentId,
        workspace_id: workspaceId,
        ...termData,
      });
      set((state) => ({
        glossary: {
          ...state.glossary,
          [documentId]: [...(state.glossary[documentId] ?? []), created],
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to add glossary term:', err);
    }
  },

  deleteGlossaryTerm: async (id, documentId) => {
    try {
      await KnowledgeRepository.deleteGlossaryTerm(id);
      set((state) => ({
        glossary: {
          ...state.glossary,
          [documentId]: (state.glossary[documentId] ?? []).filter((t) => t.id !== id),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to delete glossary term:', err);
    }
  },

  // --- Mind Map ---
  addMindMapNode: async (documentId, workspaceId, nodeData) => {
    try {
      const created = await KnowledgeRepository.addMindMapNode({
        document_id: documentId,
        workspace_id: workspaceId,
        ...nodeData,
      });
      set((state) => ({
        mindMapNodes: {
          ...state.mindMapNodes,
          [documentId]: [...(state.mindMapNodes[documentId] ?? []), created],
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to add mind map node:', err);
    }
  },

  deleteMindMapNode: async (id, documentId) => {
    try {
      await KnowledgeRepository.deleteMindMapNode(id);
      set((state) => ({
        mindMapNodes: {
          ...state.mindMapNodes,
          [documentId]: (state.mindMapNodes[documentId] ?? []).filter((n) => n.id !== id),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to delete mind map node:', err);
    }
  },

  // --- Timeline ---
  addTimelineEvent: async (documentId, workspaceId, eventData) => {
    try {
      const created = await KnowledgeRepository.addTimelineEvent({
        document_id: documentId,
        workspace_id: workspaceId,
        ...eventData,
      });
      set((state) => ({
        timelineEvents: {
          ...state.timelineEvents,
          [documentId]: [...(state.timelineEvents[documentId] ?? []), created],
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to add timeline event:', err);
    }
  },

  deleteTimelineEvent: async (id, documentId) => {
    try {
      await KnowledgeRepository.deleteTimelineEvent(id);
      set((state) => ({
        timelineEvents: {
          ...state.timelineEvents,
          [documentId]: (state.timelineEvents[documentId] ?? []).filter((e) => e.id !== id),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to delete timeline event:', err);
    }
  },

  setStudyMode: (active) => set({ isStudyModeActive: active }),

  generateFlashcards: async (documentId, workspaceId) => {
    set({ isGenerating: true, generationError: null });
    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase.functions.invoke('generate-knowledge', {
        body: { document_id: documentId, workspace_id: workspaceId, action_type: 'flashcards' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      set((state) => ({
        flashcards: { ...state.flashcards, [documentId]: [...(state.flashcards[documentId] ?? []), ...(data?.items ?? [])] },
        isGenerating: false,
      }));
    } catch (err: any) {
      set({ isGenerating: false, generationError: err.message });
      throw err;
    }
  },

  generateGlossary: async (documentId, workspaceId) => {
    set({ isGenerating: true, generationError: null });
    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase.functions.invoke('generate-knowledge', {
        body: { document_id: documentId, workspace_id: workspaceId, action_type: 'glossary' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      set((state) => ({
        glossary: { ...state.glossary, [documentId]: [...(state.glossary[documentId] ?? []), ...(data?.items ?? [])] },
        isGenerating: false,
      }));
    } catch (err: any) {
      set({ isGenerating: false, generationError: err.message });
      throw err;
    }
  },

  generateMindMap: async (documentId, workspaceId) => {
    set({ isGenerating: true, generationError: null });
    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase.functions.invoke('generate-knowledge', {
        body: { document_id: documentId, workspace_id: workspaceId, action_type: 'mindmap' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      set((state) => ({
        mindMapNodes: { ...state.mindMapNodes, [documentId]: [...(state.mindMapNodes[documentId] ?? []), ...(data?.items ?? [])] },
        isGenerating: false,
      }));
    } catch (err: any) {
      set({ isGenerating: false, generationError: err.message });
      throw err;
    }
  },
}));
