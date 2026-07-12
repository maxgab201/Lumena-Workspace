import { create } from 'zustand';
import type { Highlight, HighlightCategory } from '../types/highlights';

interface HighlightStoreState {
  highlights: Record<string, Highlight[]>; // Keyed by documentId
  categories: HighlightCategory[];
  activeHighlightId: string | null;

  // Actions
  addHighlight: (highlight: Highlight) => void;
  updateHighlight: (id: string, updates: Partial<Highlight>) => void;
  removeHighlight: (id: string) => void;
  setActiveHighlight: (id: string | null) => void;
  
  // Selectors
  getHighlightsForPage: (documentId: string, pageIndex: number) => Highlight[];
}

export const useHighlightStore = create<HighlightStoreState>((set, get) => ({
  highlights: {},
  categories: [
    { id: 'cat-1', name: 'Important', color: '#fef08a' }, // yellow-200
    { id: 'cat-2', name: 'Definition', color: '#bfdbfe' }, // blue-200
    { id: 'cat-3', name: 'Question', color: '#fecaca' }, // red-200
  ],
  activeHighlightId: null,

  addHighlight: (highlight) => set((state) => {
    const docHighlights = state.highlights[highlight.documentId] || [];
    return {
      highlights: {
        ...state.highlights,
        [highlight.documentId]: [...docHighlights, highlight]
      }
    };
  }),

  updateHighlight: (id, updates) => set((state) => {
    const newHighlights = { ...state.highlights };
    let updated = false;

    for (const docId in newHighlights) {
      const idx = newHighlights[docId].findIndex(h => h.id === id);
      if (idx !== -1) {
        newHighlights[docId][idx] = { ...newHighlights[docId][idx], ...updates, updatedAt: Date.now() };
        updated = true;
        break;
      }
    }

    if (!updated) return state;
    return { highlights: newHighlights };
  }),

  removeHighlight: (id) => set((state) => {
    const newHighlights = { ...state.highlights };
    for (const docId in newHighlights) {
      newHighlights[docId] = newHighlights[docId].filter(h => h.id !== id);
    }
    return { 
      highlights: newHighlights,
      activeHighlightId: state.activeHighlightId === id ? null : state.activeHighlightId
    };
  }),

  setActiveHighlight: (id) => set({ activeHighlightId: id }),

  getHighlightsForPage: (documentId, pageIndex) => {
    const docHighlights = get().highlights[documentId] || [];
    return docHighlights.filter(h => h.pageIndex === pageIndex);
  }
}));
