import { create } from 'zustand';
import { HighlightRepository } from '../repositories/highlight.repository';
import type { Highlight, HighlightCategory, NormalizedRect } from '../types/highlights';
import { toast } from 'sonner';

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
  getHighlightsForDocument: (documentId: string) => Highlight[];
  getActiveHighlight: () => Highlight | null;
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
      toast.error('Failed to save highlight', {
        description: err instanceof Error ? err.message : 'Please check your connection and try again.',
      });
      return null;
    }
  },

  updateHighlight: async (id, updates) => {
    // Save snapshot for potential rollback
    const previousHighlights = get().highlights;

    // Optimistic update
    set((state) => {
      const newHighlights = { ...state.highlights };
      for (const docId in newHighlights) {
        const idx = newHighlights[docId].findIndex((h) => h.id === id);
        if (idx !== -1) {
          newHighlights[docId] = [...newHighlights[docId]];
          newHighlights[docId][idx] = {
            ...newHighlights[docId][idx],
            ...updates,
            updated_at: new Date().toISOString(),
          };
          break;
        }
      }
      return { highlights: newHighlights };
    });

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
      // Rollback on failure
      set({ highlights: previousHighlights });
      toast.error('Failed to update highlight', {
        description: err instanceof Error ? err.message : 'The change could not be saved.',
      });
    }
  },

  removeHighlight: async (id) => {
    // Save snapshot for potential rollback
    const previousHighlights = get().highlights;
    const previousActive = get().activeHighlightId;

    // Optimistic remove
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

    try {
      await HighlightRepository.deleteHighlight(id);
    } catch (err) {
      console.error('[HighlightStore] Failed to remove highlight:', err);
      // Rollback on failure
      set({ highlights: previousHighlights, activeHighlightId: previousActive });
      toast.error('Failed to delete highlight', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  },

  setActiveHighlight: (id) => set({ activeHighlightId: id }),

  getHighlightsForPage: (documentId, pageIndex) => {
    const docHighlights = get().highlights[documentId] ?? [];
    return docHighlights.filter((h) => h.page_index === pageIndex);
  },

  getHighlightsForDocument: (documentId) => {
    return get().highlights[documentId] ?? [];
  },

  getActiveHighlight: () => {
    const { activeHighlightId, highlights } = get();
    if (!activeHighlightId) return null;
    for (const docId in highlights) {
      const found = highlights[docId]?.find((h) => h.id === activeHighlightId);
      if (found) return found;
    }
    return null;
  },
}));
