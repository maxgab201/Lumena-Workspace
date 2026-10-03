import { create } from 'zustand';
import { HighlightRepository } from '../repositories/highlight.repository';
import type { Highlight, HighlightCategory, NormalizedRect } from '../types/highlights';
import { toast } from 'sonner';
import { getSessionEpoch, registerSessionReset } from './sessionReset';

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
    source?: 'manual' | 'ai';
    ai_metadata?: Highlight['ai_metadata'];
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

type HighlightMap = Record<string, Highlight[]>;

let latestCategoriesLoad = 0;

function findHighlight(map: HighlightMap, id: string): Highlight | null {
  for (const list of Object.values(map)) {
    const found = list.find((h) => h.id === id);
    if (found) return found;
  }
  return null;
}

/** Changes one highlight and leaves every other list reference untouched. */
function patchHighlight(map: HighlightMap, id: string, changes: Partial<Highlight>): HighlightMap {
  for (const [documentId, list] of Object.entries(map)) {
    const index = list.findIndex((h) => h.id === id);
    if (index === -1) continue;
    const next = [...list];
    next[index] = { ...list[index], ...changes };
    return { ...map, [documentId]: next };
  }
  return map;
}

/**
 * Puts a highlight back where the repository would list it (page, then creation time). A remembered
 * array index cannot do that: after several deletes the list the index referred to no longer exists.
 */
function insertInReadingOrder(list: Highlight[], highlight: Highlight): Highlight[] {
  const comesAfter = (other: Highlight) =>
    other.page_index !== highlight.page_index
      ? other.page_index > highlight.page_index
      : String(other.created_at) > String(highlight.created_at);
  const at = list.findIndex(comesAfter);
  const next = [...list];
  next.splice(at === -1 ? next.length : at, 0, highlight);
  return next;
}

function replaceHighlight(map: HighlightMap, highlight: Highlight): HighlightMap {
  for (const [documentId, list] of Object.entries(map)) {
    const index = list.findIndex((h) => h.id === highlight.id);
    if (index === -1) continue;
    const next = [...list];
    next[index] = highlight;
    return { ...map, [documentId]: next };
  }
  return map;
}

export const useHighlightStore = create<HighlightStoreState>((set, get) => ({
  highlights: {},
  categories: [],
  activeHighlightId: null,
  isLoading: false,

  loadHighlights: async (documentId) => {
    const epoch = getSessionEpoch();
    set({ isLoading: true });
    try {
      const highlights = await HighlightRepository.listHighlights(documentId);
      if (epoch !== getSessionEpoch()) return;
      set((state) => ({
        highlights: { ...state.highlights, [documentId]: highlights },
        isLoading: false,
      }));
    } catch (err) {
      if (epoch !== getSessionEpoch()) return;
      console.error('[HighlightStore] Failed to load highlights:', err);
      set({ isLoading: false });
    }
  },

  loadCategories: async (workspaceId) => {
    const epoch = getSessionEpoch();
    const request = ++latestCategoriesLoad;
    try {
      const categories = await HighlightRepository.listCategories(workspaceId);
      if (epoch !== getSessionEpoch() || request !== latestCategoriesLoad) return;
      set({ categories });
    } catch (err) {
      if (epoch !== getSessionEpoch() || request !== latestCategoriesLoad) return;
      console.error('[HighlightStore] Failed to load categories:', err);
    }
  },

  addHighlight: async (highlightData) => {
    try {
      // Default provenance to 'manual' — AI highlights pass source='ai'.
      const created = await HighlightRepository.createHighlight({
        ...highlightData,
        source: highlightData.source ?? 'manual',
      });
      set((state) => {
        const existing = state.highlights[highlightData.document_id] ?? [];
        // A refresh made while this save was in flight may already have brought the new highlight in.
        const next = existing.some((h) => h.id === created.id)
          ? existing.map((h) => (h.id === created.id ? created : h))
          : [...existing, created];
        return {
          highlights: {
            ...state.highlights,
            [highlightData.document_id]: next,
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
    // What this edit overwrites, so a failure can put back exactly that and nothing else. Restoring a
    // snapshot of the whole store would also undo every other change made while this one was in flight.
    const before = findHighlight(get().highlights, id);
    const overwritten = before
      ? (Object.fromEntries(Object.keys(updates).map((key) => [key, (before as unknown as Record<string, unknown>)[key]])) as Partial<Highlight>)
      : null;
    const previousUpdatedAt = before?.updated_at;

    // Optimistic update
    set((state) => ({ highlights: patchHighlight(state.highlights, id, { ...updates, updated_at: new Date().toISOString() }) }));

    try {
      const updated = await HighlightRepository.updateHighlight(id, updates);
      set((state) => ({ highlights: replaceHighlight(state.highlights, updated) }));
    } catch (err) {
      console.error('[HighlightStore] Failed to update highlight:', err);
      // Rollback on failure: only this edit's fields
      if (overwritten) {
        set((state) => ({ highlights: patchHighlight(state.highlights, id, { ...overwritten, updated_at: previousUpdatedAt }) }));
      }
      toast.error('Failed to update highlight', {
        description: err instanceof Error ? err.message : 'The change could not be saved.',
      });
    }
  },

  removeHighlight: async (id) => {
    // The highlight itself, so a failed delete puts back this one highlight and nothing else.
    let removed: { documentId: string; highlight: Highlight } | null = null;
    for (const [documentId, list] of Object.entries(get().highlights)) {
      const highlight = list.find((h) => h.id === id);
      if (highlight) {
        removed = { documentId, highlight };
        break;
      }
    }
    const wasActive = get().activeHighlightId === id;

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
      if (removed) {
        const { documentId, highlight } = removed;
        set((state) => {
          const current = state.highlights[documentId] ?? [];
          if (current.some((h) => h.id === id)) return {};
          const restored = insertInReadingOrder(current, highlight);
          return {
            highlights: { ...state.highlights, [documentId]: restored },
            ...(wasActive && state.activeHighlightId === null ? { activeHighlightId: id } : {}),
          };
        });
      }
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

registerSessionReset(() => {
  useHighlightStore.setState(useHighlightStore.getInitialState(), true);
});
