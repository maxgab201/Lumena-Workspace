import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHighlightStore } from '../../src/stores/highlightStore';
import type { Highlight } from '../../src/types/highlights';

// Mock the repository — the store must stay decoupled from Supabase.
vi.mock('../../src/repositories/highlight.repository', () => ({
  HighlightRepository: {
    listHighlights: vi.fn().mockResolvedValue([]),
    listHighlightsForPage: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([]),
    createHighlight: vi.fn(async (h: any) => ({
      id: 'h-new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category_id: null,
      note: null,
      ...h,
    }) as Highlight),
    updateHighlight: vi.fn(async (id: string, updates: any) => ({
      id,
      document_id: 'doc-1',
      workspace_id: 'ws-1',
      page_index: 0,
      rects: [],
      text: 'seed',
      color: '#fef08a',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...updates,
    }) as Highlight),
    deleteHighlight: vi.fn().mockResolvedValue(undefined),
  },
}));

const SEED: Highlight = {
  id: 'h-1',
  document_id: 'doc-1',
  workspace_id: 'ws-1',
  page_index: 0,
  rects: [{ x: 0.1, y: 0.1, width: 0.3, height: 0.02 }],
  text: 'seed text',
  color: '#fef08a',
  category_id: null,
  note: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('HighlightStore immediate reactivity (Checkpoint 2 Bug 3)', () => {
  beforeEach(() => {
    // Reset store to a clean state with one seeded highlight.
    useHighlightStore.setState({
      highlights: { 'doc-1': [SEED] },
      activeHighlightId: null,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it('addHighlight inserts into the store with a NEW collection reference (subscriber-safe)', async () => {
    const before = useHighlightStore.getState().highlights['doc-1'];

    await useHighlightStore.getState().addHighlight({
      document_id: 'doc-1',
      workspace_id: 'ws-1',
      page_index: 0,
      rects: [{ x: 0.2, y: 0.2, width: 0.3, height: 0.02 }],
      text: 'new highlight',
      color: '#bfdbfe',
    });

    const after = useHighlightStore.getState().highlights['doc-1'];
    expect(after).toHaveLength(2);
    // New reference is what triggers reactive subscribers (Zustand strict mode).
    expect(after).not.toBe(before);
    expect(after.some((h) => h.text === 'new highlight')).toBe(true);
  });

  it('updateHighlight (note) emits an immediate, referentially-new update', async () => {
    const before = useHighlightStore.getState().highlights['doc-1'];

    await useHighlightStore.getState().updateHighlight('h-1', { note: 'mi nota' });

    const after = useHighlightStore.getState().highlights['doc-1'];
    expect(after).not.toBe(before);
    expect(after[0].note).toBe('mi nota');
  });

  it('updateHighlight (color) emits an immediate update', async () => {
    await useHighlightStore.getState().updateHighlight('h-1', { color: '#bbf7d0' });
    expect(useHighlightStore.getState().highlights['doc-1'][0].color).toBe('#bbf7d0');
  });

  it('removeHighlight removes immediately and clears active selection', async () => {
    useHighlightStore.setState({ activeHighlightId: 'h-1' });

    await useHighlightStore.getState().removeHighlight('h-1');

    expect(useHighlightStore.getState().highlights['doc-1']).toHaveLength(0);
    expect(useHighlightStore.getState().activeHighlightId).toBeNull();
  });

  it('per-page derivation reflects store updates without panel involvement', async () => {
    const store = useHighlightStore.getState();

    // The overlay derives from the collection; simulate exactly that.
    const page0Before = (useHighlightStore.getState().highlights['doc-1'] ?? [])
      .filter((h) => h.page_index === 0);
    expect(page0Before).toHaveLength(1);

    await store.addHighlight({
      document_id: 'doc-1',
      workspace_id: 'ws-1',
      page_index: 1,
      rects: [{ x: 0.2, y: 0.2, width: 0.3, height: 0.02 }],
      text: 'page 2 highlight',
      color: '#fecaca',
    });

    const page0After = (useHighlightStore.getState().highlights['doc-1'] ?? [])
      .filter((h) => h.page_index === 0);
    const page1After = (useHighlightStore.getState().highlights['doc-1'] ?? [])
      .filter((h) => h.page_index === 1);
    expect(page0After).toHaveLength(1); // untouched
    expect(page1After).toHaveLength(1); // new one visible immediately
  });

  it('rolls back the optimistic update when the backend fails (no ghost highlight)', async () => {
    const { HighlightRepository } = await import('../../src/repositories/highlight.repository');
    (HighlightRepository.createHighlight as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network down')
    );

    const result = await useHighlightStore.getState().addHighlight({
      document_id: 'doc-1',
      workspace_id: 'ws-1',
      page_index: 0,
      rects: [],
      text: 'ghost',
      color: '#fef08a',
    });

    expect(result).toBeNull();
    expect(useHighlightStore.getState().highlights['doc-1']).toHaveLength(1); // seed only
  });
});
