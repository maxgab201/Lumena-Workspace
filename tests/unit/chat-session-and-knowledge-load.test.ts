import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Production smoke test (real login, no mocks) logged two console errors while opening the
 * reader of a fresh document:
 *  - 409 POST /chat_sessions (duplicate key chat_sessions_document_id_user_id_key): two callers
 *    raced past the "does a session exist?" lookup and the loser failed the whole load.
 *  - 404 GET /presentations (the table does not exist in production) rejected
 *    KnowledgeRepository.loadAllForDocument, so flashcards, glossary, mind map and timeline
 *    never loaded for ANY document.
 */
const harness = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  /** scripted results per table, consumed in call order */
  scripts: {} as Record<string, Array<{ data?: unknown; error?: { code?: string; message: string } | null }>>,
  calls: [] as string[],
}));

vi.mock('../../src/lib/supabase', () => {
  function builder(table: string) {
    let op = 'select';
    const api: Record<string, unknown> = {
      select: () => api,
      insert: () => { op = 'insert'; return api; },
      eq: () => api,
      order: () => api,
      single: () => api,
      maybeSingle: () => api,
      then: (resolve: (value: unknown) => unknown) => {
        harness.calls.push(`${table}.${op}`);
        const next = harness.scripts[`${table}.${op}`]?.shift() ?? { data: null, error: null };
        return Promise.resolve({ data: next.data ?? null, error: next.error ?? null }).then(resolve);
      },
    };
    return api;
  }
  return {
    supabase: {
      from: (table: string) => builder(table),
      auth: { getUser: async () => ({ data: { user: harness.user } }) },
    },
  };
});

import { ChatRepository } from '../../src/repositories/chat.repository';
import { KnowledgeRepository } from '../../src/repositories/knowledge.repository';

beforeEach(() => {
  harness.user = { id: 'user-1' };
  harness.scripts = {};
  harness.calls = [];
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('ChatRepository.getOrCreateSession', () => {
  const session = { id: 'session-1', document_id: 'doc-1', user_id: 'user-1' };

  it('returns the existing session without inserting', async () => {
    harness.scripts['chat_sessions.select'] = [{ data: session }];

    await expect(ChatRepository.getOrCreateSession('doc-1', 'ws-1')).resolves.toEqual(session);
    expect(harness.calls).toEqual(['chat_sessions.select']);
  });

  it('creates the session when there is none', async () => {
    harness.scripts['chat_sessions.select'] = [{ data: null }];
    harness.scripts['chat_sessions.insert'] = [{ data: session }];

    await expect(ChatRepository.getOrCreateSession('doc-1', 'ws-1')).resolves.toEqual(session);
  });

  it('reads the session the other caller created when it loses the insert race (23505)', async () => {
    harness.scripts['chat_sessions.select'] = [{ data: null }, { data: session }];
    harness.scripts['chat_sessions.insert'] = [
      { error: { code: '23505', message: 'duplicate key value violates unique constraint "chat_sessions_document_id_user_id_key"' } },
    ];

    await expect(ChatRepository.getOrCreateSession('doc-1', 'ws-1')).resolves.toEqual(session);
    expect(harness.calls).toEqual(['chat_sessions.select', 'chat_sessions.insert', 'chat_sessions.select']);
  });

  it('still fails on an insert error that is not a duplicate', async () => {
    harness.scripts['chat_sessions.select'] = [{ data: null }];
    harness.scripts['chat_sessions.insert'] = [{ error: { code: '42501', message: 'row-level security' } }];

    await expect(ChatRepository.getOrCreateSession('doc-1', 'ws-1')).rejects.toMatchObject({ code: '42501' });
  });

  it('fails when a duplicate was reported but the session cannot be read back', async () => {
    harness.scripts['chat_sessions.select'] = [{ data: null }, { data: null }];
    harness.scripts['chat_sessions.insert'] = [{ error: { code: '23505', message: 'duplicate' } }];

    await expect(ChatRepository.getOrCreateSession('doc-1', 'ws-1')).rejects.toMatchObject({ code: '23505' });
  });

  it('refuses to run without a signed-in user', async () => {
    harness.user = null;
    await expect(ChatRepository.getOrCreateSession('doc-1', 'ws-1')).rejects.toThrow('Not authenticated');
  });
});

describe('KnowledgeRepository.loadAllForDocument', () => {
  const missingTable = { code: 'PGRST205', message: "Could not find the table 'public.presentations' in the schema cache" };

  it('still returns flashcards, glossary, mind map and timeline when one table is missing', async () => {
    harness.scripts['flashcards.select'] = [{ data: [{ id: 'f1' }] }];
    harness.scripts['glossary_terms.select'] = [{ data: [{ id: 'g1' }, { id: 'g2' }] }];
    harness.scripts['mind_map_nodes.select'] = [{ data: [{ id: 'm1' }] }];
    harness.scripts['timeline_events.select'] = [{ data: [{ id: 't1' }] }];
    harness.scripts['presentations.select'] = [{ error: missingTable }];

    const loaded = await KnowledgeRepository.loadAllForDocument('doc-1');

    expect(loaded.flashcards).toEqual([{ id: 'f1' }]);
    expect(loaded.glossaryTerms).toHaveLength(2);
    expect(loaded.mindMapNodes).toEqual([{ id: 'm1' }]);
    expect(loaded.timelineEvents).toEqual([{ id: 't1' }]);
    expect(loaded.presentations).toEqual([]);
  });

  it('keeps the other sections when a different one fails', async () => {
    harness.scripts['flashcards.select'] = [{ error: { message: 'timeout' } }];
    harness.scripts['glossary_terms.select'] = [{ data: [{ id: 'g1' }] }];

    const loaded = await KnowledgeRepository.loadAllForDocument('doc-1');

    expect(loaded.flashcards).toEqual([]);
    expect(loaded.glossaryTerms).toEqual([{ id: 'g1' }]);
  });

  it('still reports an error when EVERY section fails (offline, expired session)', async () => {
    for (const table of ['flashcards', 'glossary_terms', 'mind_map_nodes', 'timeline_events', 'presentations']) {
      harness.scripts[`${table}.select`] = [{ error: { message: 'JWT expired' } }];
    }

    await expect(KnowledgeRepository.loadAllForDocument('doc-1')).rejects.toMatchObject({ message: 'JWT expired' });
  });

  it('returns empty sections for a document with no knowledge yet', async () => {
    const loaded = await KnowledgeRepository.loadAllForDocument('doc-1');
    expect(loaded).toEqual({ flashcards: [], glossaryTerms: [], mindMapNodes: [], timelineEvents: [], presentations: [] });
  });
});
