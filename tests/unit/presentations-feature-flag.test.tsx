import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Presentations is a "Soon" feature and its table does not exist in production. Opening a document
 * used to ask for it anyway and log a 404 (PGRST205) every time, with the error swallowed afterwards.
 * It is behind VITE_FEATURE_PRESENTATIONS now: while the flag is off nothing is requested for it and
 * the UI does not offer it.
 */
const harness = vi.hoisted(() => ({
  tables: [] as string[],
  failing: new Set<string>(),
  rows: {} as Record<string, unknown[]>,
  invoked: [] as string[],
}));

vi.mock('../../src/lib/supabase', () => {
  function builder(table: string) {
    harness.tables.push(table);
    const api: Record<string, unknown> = {
      select: () => api,
      eq: () => api,
      order: () => api,
      insert: () => api,
      update: () => api,
      delete: () => api,
      single: () => api,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(
          harness.failing.has(table)
            ? { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}'` } }
            : { data: harness.rows[table] ?? [], error: null },
        ).then(resolve),
    };
    return api;
  }
  return {
    supabase: {
      from: builder,
      functions: { invoke: (name: string) => { harness.invoked.push(name); return Promise.resolve({ data: { items: [] }, error: null }); } },
    },
  };
});

vi.mock('../../src/components/knowledge/FlashcardsView', () => ({ FlashcardsView: () => <div data-testid="view-flashcards" /> }));
vi.mock('../../src/components/knowledge/GlossaryView', () => ({ GlossaryView: () => <div data-testid="view-glossary" /> }));
vi.mock('../../src/components/knowledge/MindMapView', () => ({ MindMapView: () => <div data-testid="view-mindmap" /> }));
vi.mock('../../src/components/knowledge/TimelineView', () => ({ TimelineView: () => <div data-testid="view-timeline" /> }));
vi.mock('../../src/components/knowledge/PresentationView', () => ({
  PresentationView: () => <button data-testid="generate-presentation-btn">Generate Presentation</button>,
}));

import { KnowledgeSidebar } from '../../src/components/knowledge/KnowledgeSidebar';
import { isFeatureEnabled } from '../../src/config/features';
import { KnowledgeRepository } from '../../src/repositories/knowledge.repository';
import { useKnowledgeStore } from '../../src/stores/knowledgeStore';

const KNOWLEDGE_TABLES = ['flashcards', 'glossary_terms', 'mind_map_nodes', 'timeline_events'];

beforeEach(() => {
  harness.tables = [];
  harness.failing = new Set();
  harness.rows = {};
  harness.invoked = [];
  vi.stubEnv('VITE_FEATURE_PRESENTATIONS', '');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('isFeatureEnabled', () => {
  it('is off unless the flag is explicitly "true" or "1"', () => {
    for (const value of ['', 'false', '0', 'yes', 'TRUE']) {
      vi.stubEnv('VITE_FEATURE_PRESENTATIONS', value);
      expect(isFeatureEnabled('presentations'), `"${value}"`).toBe(false);
    }
    for (const value of ['true', '1']) {
      vi.stubEnv('VITE_FEATURE_PRESENTATIONS', value);
      expect(isFeatureEnabled('presentations'), `"${value}"`).toBe(true);
    }
  });
});

describe('opening a document with Presentations off', () => {
  it('never queries the presentations table (no 404 on every open)', async () => {
    // The repository methods refuse on their own, so also pin that the loader does not even ask:
    // a rejected-and-swallowed call is not a substitute for not making it.
    const list = vi.spyOn(KnowledgeRepository, 'listPresentations');

    await KnowledgeRepository.loadAllForDocument('doc-1');

    expect(list).not.toHaveBeenCalled();
    expect(harness.tables).not.toContain('presentations');
    expect([...harness.tables].sort()).toEqual([...KNOWLEDGE_TABLES].sort());
  });

  it('does not query it through the store either (what the Reader calls on open)', async () => {
    harness.rows.flashcards = [{ id: 'f1' }];

    await useKnowledgeStore.getState().loadKnowledge('doc-1');

    expect(harness.tables).not.toContain('presentations');
    expect(useKnowledgeStore.getState().flashcards['doc-1']).toEqual([{ id: 'f1' }]);
    expect(useKnowledgeStore.getState().presentations['doc-1']).toEqual([]);
  });

  it('still surfaces an error when every section that IS requested fails', async () => {
    // an empty, skipped presentations section must not count as a success and hide this
    for (const table of KNOWLEDGE_TABLES) harness.failing.add(table);

    await expect(KnowledgeRepository.loadAllForDocument('doc-1')).rejects.toMatchObject({ code: 'PGRST205' });
  });

  it('keeps the other sections when one of them fails', async () => {
    harness.failing.add('flashcards');
    harness.rows.glossary_terms = [{ id: 'g1' }];

    const loaded = await KnowledgeRepository.loadAllForDocument('doc-1');

    expect(loaded.flashcards).toEqual([]);
    expect(loaded.glossaryTerms).toEqual([{ id: 'g1' }]);
    expect(loaded.presentations).toEqual([]);
  });

  it('refuses every other presentation call before making a request', async () => {
    await expect(KnowledgeRepository.listPresentations('doc-1')).rejects.toThrow('not enabled');
    await expect(KnowledgeRepository.addPresentation({ document_id: 'doc-1', workspace_id: 'ws-1', title: 't', slides: [] })).rejects.toThrow('not enabled');
    await expect(KnowledgeRepository.updatePresentation('p1', { title: 'x' })).rejects.toThrow('not enabled');
    await expect(KnowledgeRepository.deletePresentation('p1')).rejects.toThrow('not enabled');

    expect(harness.tables).toEqual([]);
  });

  it('does not call the generate function for a presentation', async () => {
    await expect(useKnowledgeStore.getState().generatePresentation('doc-1', 'ws-1')).rejects.toThrow('not enabled');

    expect(harness.invoked).toEqual([]);
  });
});

describe('with Presentations on', () => {
  beforeEach(() => vi.stubEnv('VITE_FEATURE_PRESENTATIONS', 'true'));

  it('loads presentations with the rest', async () => {
    harness.rows.presentations = [{ id: 'p1', slides: [] }];

    const loaded = await KnowledgeRepository.loadAllForDocument('doc-1');

    expect(harness.tables).toContain('presentations');
    expect(loaded.presentations).toEqual([{ id: 'p1', slides: [] }]);
  });

  it('a presentations failure does not hide the other sections', async () => {
    harness.failing.add('presentations');
    harness.rows.flashcards = [{ id: 'f1' }];

    const loaded = await KnowledgeRepository.loadAllForDocument('doc-1');

    expect(loaded.flashcards).toEqual([{ id: 'f1' }]);
    expect(loaded.presentations).toEqual([]);
  });

  it('lets the store call the generate function', async () => {
    await useKnowledgeStore.getState().generatePresentation('doc-1', 'ws-1');

    expect(harness.invoked).toEqual(['generate-knowledge']);
  });
});

describe('KnowledgeSidebar', () => {
  const open = () => render(<KnowledgeSidebar documentId="doc-1" workspaceId="ws-1" onClose={() => undefined} />);

  it('offers no Presentation tab and no Generate Presentation while the feature is off', () => {
    open();

    expect(screen.getByTestId('tab-flashcards')).toBeTruthy();
    expect(screen.getByTestId('tab-timeline')).toBeTruthy();
    expect(screen.queryByTestId('tab-presentation')).toBeNull();
    expect(screen.queryByTestId('generate-presentation-btn')).toBeNull();
  });

  it('offers them once the feature is on', () => {
    vi.stubEnv('VITE_FEATURE_PRESENTATIONS', 'true');
    open();

    fireEvent.click(screen.getByTestId('tab-presentation'));

    expect(screen.getByTestId('generate-presentation-btn')).toBeTruthy();
  });
});

describe('no code reaches the presentations table except through the gated repository', () => {
  const src = resolve(__dirname, '../../src');
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sources(full);
      return /\.(ts|tsx)$/.test(entry) ? [full] : [];
    });

  it('only the knowledge repository touches the table', () => {
    const offenders = sources(src)
      .filter((file) => /\.from\(\s*['"]presentations['"]\s*\)/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(src, file));

    expect(offenders).toEqual(['repositories/knowledge.repository.ts']);
  });

  it('every method of the repository that reaches it is guarded', () => {
    const source = readFileSync(resolve(src, 'repositories/knowledge.repository.ts'), 'utf8');
    const methods = source.split(/\n  async /).filter((chunk) => chunk.includes(".from('presentations')"));

    expect(methods.length).toBe(4);
    for (const method of methods) expect(method).toContain('assertPresentationsEnabled();');
  });
});
