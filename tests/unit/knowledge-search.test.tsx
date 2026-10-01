import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { WorkspaceDocument } from '../../src/types/documents';

/**
 * Found while auditing embeddings: the search box read the match type from the wrong place (the
 * badge was always empty), printed "0%" for plain text matches, said "No results" after the first
 * keystroke, took the workspace id once per render, and let a slow answer overwrite a newer one.
 */
const harness = vi.hoisted(() => {
  let workspaceId: string | undefined = 'ws-1';
  const listeners = new Set<() => void>();
  return {
    get workspaceId() {
      return workspaceId;
    },
    setWorkspace(id: string | undefined) {
      workspaceId = id;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock('../../src/stores/workspaceStore', async () => {
  const React = await import('react');
  return {
    useWorkspaceStore: Object.assign(
      (select: (state: { activeWorkspace: { id: string } | null }) => unknown) =>
        React.useSyncExternalStore(harness.subscribe, () => select({ activeWorkspace: harness.workspaceId ? { id: harness.workspaceId } : null })),
      { getState: () => ({ activeWorkspace: harness.workspaceId ? { id: harness.workspaceId } : null }) },
    ),
  };
});

import { supabase } from '../../src/lib/supabase';
import { KnowledgeSearch } from '../../src/components/chat/KnowledgeSearch';
import { formatSimilarity, parseKnowledgeSearchResponse } from '../../src/lib/knowledgeSearch';
import { hasLimitedAiSearch } from '../../src/types/documents';

const row = (overrides: Record<string, unknown> = {}) => ({
  document_id: 'doc-1',
  document_name: 'Biology.pdf',
  page_number: 2,
  chunk_index: 1,
  chunk_text: 'Photosynthesis converts light energy.',
  similarity: 0.74,
  keyword_rank: 0.3,
  combined_score: 0.6,
  citation: { match_type: 'hybrid' },
  ...overrides,
});

describe('parseKnowledgeSearchResponse', () => {
  it('reads the match type from citation, where rag-retrieve puts it', () => {
    const { results } = parseKnowledgeSearchResponse({ results: [row()] });
    expect(results[0].match_type).toBe('hybrid');
  });

  it('flags an answer that came from the stored text', () => {
    expect(parseKnowledgeSearchResponse({ results: [], degraded: { mode: 'keyword', reason: 'not_indexed' } }).degraded).toBe(true);
    expect(parseKnowledgeSearchResponse({ results: [], degraded: null }).degraded).toBe(false);
  });

  it('keeps two results of one document apart even when chunk_index is missing', () => {
    const { results } = parseKnowledgeSearchResponse({ results: [row({ chunk_index: undefined }), row({ chunk_index: undefined })] });
    expect(new Set(results.map((entry) => `${entry.document_id}-${entry.chunk_index}`)).size).toBe(2);
  });

  it('survives a malformed body instead of throwing', () => {
    expect(parseKnowledgeSearchResponse(null)).toEqual({ results: [], degraded: false });
    expect(parseKnowledgeSearchResponse({ results: 'nope' })).toEqual({ results: [], degraded: false });
    expect(parseKnowledgeSearchResponse({ results: [null, { chunk_text: 'no document id' }] }).results).toEqual([]);
  });
});

describe('formatSimilarity', () => {
  it('shows a percentage for semantic matches only', () => {
    expect(formatSimilarity({ similarity: 0.736, match_type: 'hybrid' })).toBe('74%');
    expect(formatSimilarity({ similarity: 0, match_type: 'keyword' })).toBeNull();
    expect(formatSimilarity({ similarity: 0.9, match_type: 'keyword' })).toBeNull();
    expect(formatSimilarity({ similarity: 0, match_type: 'hybrid' })).toBeNull();
  });
});

describe('hasLimitedAiSearch', () => {
  const doc = (overrides: Partial<WorkspaceDocument> = {}): WorkspaceDocument => ({
    id: 'd', workspace_id: 'w', name: 'a.pdf', size_bytes: 1, status: 'ready', file_path: 'p', created_at: '2026-01-01',
    ...overrides,
  });

  it('is true for a ready document whose indexing stopped short', () => {
    expect(hasLimitedAiSearch(doc({ embedding_status: 'failed', embedding_error: 'rate-limited' }))).toBe(true);
  });

  it('is false when indexing completed, is still pending (a scan) or the document itself is not ready', () => {
    expect(hasLimitedAiSearch(doc({ embedding_status: 'completed' }))).toBe(false);
    expect(hasLimitedAiSearch(doc({ embedding_status: 'pending' }))).toBe(false);
    expect(hasLimitedAiSearch(doc())).toBe(false);
    expect(hasLimitedAiSearch(doc({ status: 'processing', embedding_status: 'failed' }))).toBe(false);
  });
});

describe('the document card offers a way out of a limited AI search', () => {
  const read = (path: string) => readFileSync(resolve(__dirname, '../../', path), 'utf8');

  it('shows the notice for hasLimitedAiSearch documents and retries through the existing retryDocument flow', () => {
    const source = read('src/pages/Dashboard.tsx');
    expect(source).toContain('hasLimitedAiSearch(doc)');
    expect(source).toContain('document-ai-index-${doc.id}');
    expect(source).toMatch(/t\('document\.aiIndexRetry'\)/);
    // the notice is its own block: a limited AI search must not look like a failed document
    expect(source).toContain("{stage === 'failed' && (");
  });

  it('has the labels in both languages', () => {
    for (const lang of ['en', 'es']) {
      const dictionary = read(`src/i18n/${lang}.ts`);
      for (const key of ['document.aiIndexLimited', 'document.aiIndexLimitedHint', 'document.aiIndexRetry']) {
        expect(dictionary, `${lang} is missing ${key}`).toContain(`'${key}'`);
      }
    }
  });
});

describe('<KnowledgeSearch />', () => {
  const answers: Array<(value: Response) => void> = [];
  const respond = (index: number, body: unknown, status = 200) =>
    answers[index](new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

  beforeEach(() => {
    harness.setWorkspace('ws-1');
    answers.length = 0;
    (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => answers.push(resolve))));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const search = async (text: string) => {
    fireEvent.change(screen.getByPlaceholderText('Search documents...'), { target: { value: text } });
    await act(async () => {
      fireEvent.keyDown(screen.getByPlaceholderText('Search documents...'), { key: 'Enter' });
    });
    await waitFor(() => expect(answers.length).toBeGreaterThan(0));
  };

  it('does not claim "No results" while the user is still typing', () => {
    render(<KnowledgeSearch />);
    fireEvent.change(screen.getByPlaceholderText('Search documents...'), { target: { value: 'photo' } });
    expect(screen.queryByText(/No results found/)).toBeNull();
  });

  it('shows the match type and a score for a semantic answer', async () => {
    render(<KnowledgeSearch />);
    await search('photosynthesis');
    await act(async () => respond(0, { results: [row()], degraded: null }));
    expect(await screen.findByText('hybrid')).toBeTruthy();
    expect(screen.getByText('74%')).toBeTruthy();
    expect(screen.queryByTestId('knowledge-search-text-only')).toBeNull();
  });

  it('says the answer is text-only, with no "0%", when semantic search is unavailable', async () => {
    render(<KnowledgeSearch />);
    await search('photosynthesis');
    await act(async () =>
      respond(0, {
        results: [row({ similarity: 0, citation: { match_type: 'keyword' } })],
        degraded: { mode: 'keyword', reason: 'embedding_rate_limit' },
      }),
    );
    expect(await screen.findByTestId('knowledge-search-text-only')).toBeTruthy();
    expect(screen.getByText('keyword')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('shows "No results" once a search for that exact text came back empty', async () => {
    render(<KnowledgeSearch />);
    await search('zzz');
    await act(async () => respond(0, { results: [], degraded: null }));
    expect(await screen.findByText(/No results found for "zzz"/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Search documents...'), { target: { value: 'zzzz' } });
    expect(screen.queryByText(/No results found/)).toBeNull();
  });

  it('lets only the latest search write its answer', async () => {
    render(<KnowledgeSearch />);
    await search('first');
    // second search starts before the first one answers
    fireEvent.change(screen.getByPlaceholderText('Search documents...'), { target: { value: 'second' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByPlaceholderText('Search documents...'), { key: 'Enter' });
    });
    await waitFor(() => expect(answers.length).toBe(2));
    await act(async () => respond(1, { results: [row({ document_name: 'Second.pdf' })] }));
    expect(await screen.findByText('Second.pdf')).toBeTruthy();
    await act(async () => respond(0, { results: [row({ document_name: 'First.pdf' })] }));
    expect(screen.queryByText('First.pdf')).toBeNull();
    expect(screen.getByText('Second.pdf')).toBeTruthy();
  });

  it('drops an answer that arrives after the user switched workspace', async () => {
    render(<KnowledgeSearch />);
    await search('photosynthesis');
    await act(async () => harness.setWorkspace('ws-2'));
    await act(async () => respond(0, { results: [row({ document_name: 'WorkspaceOne.pdf' })] }));
    expect(screen.queryByText('WorkspaceOne.pdf')).toBeNull();
    expect(screen.queryByText(/No results found/)).toBeNull();
  });

  it('sends the workspace that is active when the search starts', async () => {
    harness.setWorkspace('ws-9');
    render(<KnowledgeSearch />);
    await search('anything');
    const body = JSON.parse(((fetch as Mock).mock.calls[0][1] as RequestInit).body as string);
    expect(body.workspace_id).toBe('ws-9');
  });
});
