import { create } from 'zustand';
import type { Flashcard, GlossaryTerm, MindMapNode, TimelineEvent } from '../types/knowledge';

interface KnowledgeStoreState {
  flashcards: Record<string, Flashcard[]>;
  glossary: Record<string, GlossaryTerm[]>;
  mindMapNodes: Record<string, MindMapNode[]>;
  timelineEvents: Record<string, TimelineEvent[]>;
  isStudyModeActive: boolean;

  // Actions
  addFlashcard: (documentId: string, card: Omit<Flashcard, 'id' | 'createdAt' | 'documentId'>) => void;
  addGlossaryTerm: (documentId: string, term: Omit<GlossaryTerm, 'id' | 'createdAt' | 'documentId'>) => void;
  setStudyMode: (active: boolean) => void;
}

export const useKnowledgeStore = create<KnowledgeStoreState>((set) => ({
  flashcards: {},
  glossary: {},
  mindMapNodes: {},
  timelineEvents: {},
  isStudyModeActive: false,

  addFlashcard: (documentId, cardData) => set((state) => {
    const existing = state.flashcards[documentId] || [];
    const newCard: Flashcard = {
      ...cardData,
      id: crypto.randomUUID(),
      documentId,
      createdAt: Date.now()
    };
    return {
      flashcards: {
        ...state.flashcards,
        [documentId]: [...existing, newCard]
      }
    };
  }),

  addGlossaryTerm: (documentId, termData) => set((state) => {
    const existing = state.glossary[documentId] || [];
    const newTerm: GlossaryTerm = {
      ...termData,
      id: crypto.randomUUID(),
      documentId,
      createdAt: Date.now()
    };
    return {
      glossary: {
        ...state.glossary,
        [documentId]: [...existing, newTerm]
      }
    };
  }),

  setStudyMode: (active) => set({ isStudyModeActive: active })
}));
