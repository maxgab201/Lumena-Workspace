import { create } from 'zustand';
import { HighlightRepository } from '../repositories/highlight.repository';
import type { Highlight, HighlightCategory, NormalizedRect } from '../types/highlights';

interface HighlightStoreState {
  // Highlights keyed by document_id
  highlights: Record<string, Highlight[]>;
  categories: HighlightCategory[];
  activeHighlightId: string | null;
  isLoading: boolean;

  // Actions
  loadHighlights: (documentId: string) => Promise<void>;
  loadCategories: (workspaceId: string) => Promise<void>;

  addHighlight: (highlight: {
    document_id: string;
    workspace_id: string;
    page_index: number;
    rects: NormalizedRect[];
    text: string;
    color: string;
    category_id?: string;
    note?: string;
  }) => Promise<Highlight | null>;

  updateHighlight: (
    id: string,
    updates: Partial<Pick<Highlight, 'color' | 'note' | 'category_id' | 'text'>>,
  ) => Promise<void>;

  removeHighlight: (id: string) => Promise<void>;

  setActiveHighlight: (id: string | null) => void;

  // Selectors
  getHighlightsForPage: (documentId: string, pageIndex: number) => Highlight[];
}

export const useHighlightStore = create<HighlightStoreState>((set, get) => ({
  highlights: {},
  categories: [],
  activeHighlightId: null,
  isLoading: false,

  loadHighlights: async (documentId) => {
    set({ isLoading: true });
    try {
      const highlights = await HighlightRepository.listHighlights(documentId);
      set((state) => ({
        highlights: { ...state.highlights, [documentId]: highlights },
        isLoading: false,
      }));
    } catch (err) {
      console.error('[HighlightStore] Failed to load highlights:', err);
      set({ isLoading: false });
    }
  },

  loadCategories: async (workspaceId) => {
    try {
      const categories = await HighlightRepository.listCategories(workspaceId);
      set({ categories });
    } catch (err) {
      console.error('[HighlightStore] Failed to load categories:', err);
    }
  },

  addHighlight: async (highlightData) => {
    try {
      const created = await HighlightRepository.createHighlight(highlightData);
      set((state) => {
        const existing = state.highlights[highlightData.document_id] ?? [];
        return {
          highlights: {
            ...state.highlights,
            [highlightData.document_id]: [...existing, created],
          },
        };
      });
      return created;
    } catch (err) {
      console.error('[HighlightStore] Failed to add highlight:', err);
      return null;
    }
  },

  updateHighlight: async (id, updates) => {
    try {
      const updated = await HighlightRepository.updateHighlight(id, updates);
      set((state) => {
        const newHighlights = { ...state.highlights };
        for (const docId in newHighlights) {
          const idx = newHighlights[docId].findIndex((h) => h.id === id);
          if (idx !== -1) {
            newHighlights[docId] = [...newHighlights[docId]];
            newHighlights[docId][idx] = updated;
            break;
          }
        }
        return { highlights: newHighlights };
      });
    } catch (err) {
      console.error('[HighlightStore] Failed to update highlight:', err);
    }
  },

  removeHighlight: async (id) => {
    try {
      await HighlightRepository.deleteHighlight(id);
      set((state) => {
        const newHighlights = { ...state.highlights };
        for (const docId in newHighlights) {
          newHighlights[docId] = newHighlights[docId].filter((h) => h.id !== id);
        }
        return {
          highlights: newHighlights,
          activeHighlightId: state.activeHighlightId === id ? null : state.activeHighlightId,
        };
      });
    } catch (err) {
      console.error('[HighlightStore] Failed to remove highlight:', err);
    }
  },

  setActiveHighlight: (id) => set({ activeHighlightId: id }),

  getHighlightsForPage: (documentId, pageIndex) => {
    const docHighlights = get().highlights[documentId] ?? [];
    return docHighlights.filter((h) => h.page_index === pageIndex);
  },
}));
