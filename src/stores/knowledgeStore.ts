import { create } from 'zustand';
import { KnowledgeRepository } from '../repositories/knowledge.repository';
import type {
  Flashcard,
  GlossaryTerm,
  MindMapNode,
  TimelineEvent,
  Presentation,
  Topic,
  Concept,
  Event,
} from '../types/knowledge';

interface KnowledgeStoreState {
  // All keyed by document_id
  flashcards: Record<string, Flashcard[]>;
  glossary: Record<string, GlossaryTerm[]>;
  mindMapNodes: Record<string, MindMapNode[]>;
  timelineEvents: Record<string, TimelineEvent[]>;
  presentations: Record<string, Presentation[]>;
  topics: Record<string, Topic[]>;
  concepts: Record<string, Concept[]>;
  events: Record<string, Event[]>;

  isStudyModeActive: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  generationError: string | null;

  // Batch load for a document (called by Viewer on open)
  loadKnowledge: (documentId: string) => Promise<void>;

  // Flashcard actions
  addFlashcard: (
    documentId: string,
    workspaceId: string,
    card: Pick<Flashcard, 'front' | 'back' | 'page_number'>,
  ) => Promise<void>;
  deleteFlashcard: (id: string, documentId: string) => Promise<void>;
  updateFlashcard: (
    id: string,
    documentId: string,
    updates: Partial<Pick<Flashcard, 'front' | 'back' | 'page_number'>>,
  ) => Promise<void>;

  // SRS actions
  reviewFlashcard: (id: string, documentId: string, grade: number) => Promise<void>;
  getDueFlashcards: (documentId: string) => Flashcard[];
  getAllDueFlashcards: (documentIds: string[]) => Flashcard[];

  // Glossary actions
  addGlossaryTerm: (
    documentId: string,
    workspaceId: string,
    term: Pick<GlossaryTerm, 'term' | 'definition' | 'page_number'>,
  ) => Promise<void>;
  deleteGlossaryTerm: (id: string, documentId: string) => Promise<void>;
  updateGlossaryTerm: (
    id: string,
    documentId: string,
    updates: Partial<Pick<GlossaryTerm, 'term' | 'definition' | 'page_number'>>,
  ) => Promise<void>;

  // Mind Map actions
  addMindMapNode: (
    documentId: string,
    workspaceId: string,
    node: Pick<MindMapNode, 'label' | 'parent_id' | 'position_x' | 'position_y'>,
  ) => Promise<void>;
  deleteMindMapNode: (id: string, documentId: string) => Promise<void>;
  updateMindMapNode: (
    id: string,
    documentId: string,
    updates: Partial<Pick<MindMapNode, 'label' | 'parent_id' | 'position_x' | 'position_y'>>,
  ) => Promise<void>;

  // Timeline actions
  addTimelineEvent: (
    documentId: string,
    workspaceId: string,
    event: Pick<TimelineEvent, 'date_str' | 'description' | 'page_number'>,
  ) => Promise<void>;
  deleteTimelineEvent: (id: string, documentId: string) => Promise<void>;

  // Presentation actions
  addPresentation: (
    documentId: string,
    workspaceId: string,
    presentation: Pick<Presentation, 'title' | 'slides'>,
  ) => Promise<void>;
  deletePresentation: (id: string, documentId: string) => Promise<void>;
  updatePresentation: (
    id: string,
    documentId: string,
    updates: Partial<Pick<Presentation, 'title' | 'slides'>>,
  ) => Promise<void>;

  setStudyMode: (active: boolean) => void;

  // AI Generation actions
  generateFlashcards: (documentId: string, workspaceId: string) => Promise<void>;
  generateGlossary: (documentId: string, workspaceId: string) => Promise<void>;
  generateMindMap: (documentId: string, workspaceId: string) => Promise<void>;
  generateTimeline: (documentId: string, workspaceId: string) => Promise<void>;
  generatePresentation: (documentId: string, workspaceId: string) => Promise<void>;
}

// SM-2 Algorithm implementation
function sm2Update(card: Flashcard, grade: number): Partial<Flashcard> {
  // grade: 0-5 (0=complete blackout, 5=perfect)
  let { ease_factor = 2.5, repetitions = 0, interval_days = 0 } = card;

  if (grade >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 6;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions += 1;
  } else {
    // Incorrect response - reset
    repetitions = 0;
    interval_days = 1;
  }

  // Update ease factor
  ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval_days);

  return {
    ease_factor,
    repetitions,
    interval_days,
    next_review_at: nextReviewAt.toISOString(),
    last_reviewed_at: new Date().toISOString(),
    last_grade: grade,
  };
}

export const useKnowledgeStore = create<KnowledgeStoreState>((set, get) => ({
  flashcards: {},
  glossary: {},
  mindMapNodes: {},
  timelineEvents: {},
  presentations: {},
  topics: {},
  concepts: {},
  events: {},
  isStudyModeActive: false,
  isLoading: false,
  isGenerating: false,
  generationError: null,

  loadKnowledge: async (documentId) => {
    set({ isLoading: true });
    try {
      const { flashcards, glossaryTerms, mindMapNodes, timelineEvents, presentations } =
        await KnowledgeRepository.loadAllForDocument(documentId);

      set((state) => ({
        flashcards: { ...state.flashcards, [documentId]: flashcards },
        glossary: { ...state.glossary, [documentId]: glossaryTerms },
        mindMapNodes: { ...state.mindMapNodes, [documentId]: mindMapNodes },
        timelineEvents: { ...state.timelineEvents, [documentId]: timelineEvents },
        presentations: { ...state.presentations, [documentId]: presentations },
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
        // Initialize SRS fields
        ease_factor: 2.5,
        repetitions: 0,
        interval_days: 0,
        next_review_at: new Date().toISOString(),
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

  updateFlashcard: async (id, documentId, updates) => {
    try {
      const updated = await KnowledgeRepository.updateFlashcard(id, updates);
      set((state) => ({
        flashcards: {
          ...state.flashcards,
          [documentId]: (state.flashcards[documentId] ?? []).map((c) =>
            c.id === id ? { ...c, ...updated } : c
          ),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to update flashcard:', err);
    }
  },

  // SRS: Review a flashcard with grade 0-5
  reviewFlashcard: async (id, documentId, grade) => {
    const card = get().flashcards[documentId]?.find((c) => c.id === id);
    if (!card) return;

    const srsUpdates = sm2Update(card, grade);
    await get().updateFlashcard(id, documentId, srsUpdates);
  },

  // Get flashcards due for review
  getDueFlashcards: (documentId) => {
    const cards = get().flashcards[documentId] || [];
    const now = new Date();
    return cards.filter((c) => {
      if (!c.next_review_at) return true; // New cards are due
      return new Date(c.next_review_at) <= now;
    });
  },

  // Get all due flashcards across multiple documents
  getAllDueFlashcards: (documentIds) => {
    const allCards: Flashcard[] = [];
    for (const docId of documentIds) {
      allCards.push(...get().getDueFlashcards(docId));
    }
    // Sort by next_review_at ascending (most overdue first)
    return allCards.sort((a, b) => {
      const aDate = a.next_review_at ? new Date(a.next_review_at).getTime() : 0;
      const bDate = b.next_review_at ? new Date(b.next_review_at).getTime() : 0;
      return aDate - bDate;
    });
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

  updateGlossaryTerm: async (id, documentId, updates) => {
    try {
      const updated = await KnowledgeRepository.updateGlossaryTerm(id, updates);
      set((state) => ({
        glossary: {
          ...state.glossary,
          [documentId]: (state.glossary[documentId] ?? []).map((t) =>
            t.id === id ? { ...t, ...updated } : t
          ),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to update glossary term:', err);
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

  updateMindMapNode: async (id, documentId, updates) => {
    try {
      const updated = await KnowledgeRepository.updateMindMapNode(id, updates);
      set((state) => ({
        mindMapNodes: {
          ...state.mindMapNodes,
          [documentId]: (state.mindMapNodes[documentId] ?? []).map((n) =>
            n.id === id ? { ...n, ...updated } : n
          ),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to update mind map node:', err);
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

  // --- Presentations ---
  addPresentation: async (documentId, workspaceId, presentationData) => {
    try {
      const created = await KnowledgeRepository.addPresentation({
        document_id: documentId,
        workspace_id: workspaceId,
        ...presentationData,
      });
      set((state) => ({
        presentations: {
          ...state.presentations,
          [documentId]: [...(state.presentations[documentId] ?? []), created],
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to add presentation:', err);
    }
  },

  deletePresentation: async (id, documentId) => {
    try {
      await KnowledgeRepository.deletePresentation(id);
      set((state) => ({
        presentations: {
          ...state.presentations,
          [documentId]: (state.presentations[documentId] ?? []).filter((p) => p.id !== id),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to delete presentation:', err);
    }
  },

  updatePresentation: async (id, documentId, updates) => {
    try {
      const updated = await KnowledgeRepository.updatePresentation(id, updates);
      set((state) => ({
        presentations: {
          ...state.presentations,
          [documentId]: (state.presentations[documentId] ?? []).map((p) =>
            p.id === id ? { ...p, ...updated } : p
          ),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to update presentation:', err);
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

  generateTimeline: async (documentId, workspaceId) => {
    set({ isGenerating: true, generationError: null });
    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase.functions.invoke('generate-knowledge', {
        body: { document_id: documentId, workspace_id: workspaceId, action_type: 'timeline' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      set((state) => ({
        timelineEvents: { ...state.timelineEvents, [documentId]: [...(state.timelineEvents[documentId] ?? []), ...(data?.items ?? [])] },
        isGenerating: false,
      }));
    } catch (err: any) {
      set({ isGenerating: false, generationError: err.message });
      throw err;
    }
  },

  generatePresentation: async (documentId, workspaceId) => {
    set({ isGenerating: true, generationError: null });
    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase.functions.invoke('generate-knowledge', {
        body: { document_id: documentId, workspace_id: workspaceId, action_type: 'presentation' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      set((state) => ({
        presentations: { ...state.presentations, [documentId]: [...(state.presentations[documentId] ?? []), ...(data?.items ?? [])] },
        isGenerating: false,
      }));
    } catch (err: any) {
      set({ isGenerating: false, generationError: err.message });
      throw err;
    }
  },
}));