import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Recording fake of the Supabase client. What matters for these regressions is the ORDER
 * in which the database and Storage are touched, and what happens when one of them fails.
 */
const harness = vi.hoisted(() => ({
  log: [] as string[],
  rows: {} as Record<string, unknown[]>,
  errors: {} as Record<string, { message: string } | undefined>,
  channelNames: [] as string[],
  rangeCalls: [] as Array<[number, number]>,
}));

vi.mock('../../src/config/env', () => ({
  env: { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'test-anon-key-123' },
}));

vi.mock('../../src/lib/supabase', () => {
  function builder(table: string) {
    let op: 'select' | 'delete' | 'update' | 'insert' = 'select';
    let range: [number, number] | null = null;
    const api: Record<string, unknown> = {
      select: () => api,
      delete: () => { op = 'delete'; return api; },
      update: () => { op = 'update'; return api; },
      insert: () => { op = 'insert'; return api; },
      eq: () => api,
      in: () => api,
      order: () => api,
      range: (from: number, to: number) => { range = [from, to]; harness.rangeCalls.push([from, to]); return api; },
      then: (resolve: (value: unknown) => unknown) => {
        harness.log.push(`db:${table}.${op}`);
        let data: unknown = null;
        if (op === 'select') {
          const all = harness.rows[table] ?? [];
          data = range ? all.slice(range[0], range[1] + 1) : all;
        }
        return Promise.resolve({ data, error: harness.errors[`${table}.${op}`] ?? null }).then(resolve);
      },
    };
    return api;
  }

  return {
    supabase: {
      from: (table: string) => builder(table),
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            harness.log.push(`storage.remove:${paths.join(',')}`);
            return { data: [], error: harness.errors['storage.remove'] ?? null };
          },
        }),
      },
      channel: (name: string) => {
        harness.channelNames.push(name);
        const channel: Record<string, unknown> = {};
        channel.on = () => channel;
        channel.subscribe = () => channel;
        channel.unsubscribe = () => Promise.resolve('ok');
        return channel;
      },
    },
  };
});

import { DocumentRepository } from '../../src/repositories/document.repository';
import { WorkspaceRepository } from '../../src/repositories/workspace.repository';

beforeEach(() => {
  harness.log.length = 0;
  harness.rows = {};
  harness.errors = {};
  harness.channelNames.length = 0;
  harness.rangeCalls.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('DocumentRepository.deleteDocument', () => {
  it('deletes the database row first and only then the Storage objects', async () => {
    await DocumentRepository.deleteDocument('d1', 'ws/d1.pdf', 'ws/thumbs/d1.png');

    expect(harness.log).toEqual(['db:documents.delete', 'storage.remove:ws/d1.pdf,ws/thumbs/d1.png']);
  });

  it('leaves the file untouched when the row cannot be deleted (no row pointing at a missing PDF)', async () => {
    harness.errors['documents.delete'] = { message: 'permission denied' };

    await expect(DocumentRepository.deleteDocument('d1', 'ws/d1.pdf')).rejects.toMatchObject({
      message: 'permission denied',
    });

    expect(harness.log).toEqual(['db:documents.delete']);
  });

  it('does not fail the user-visible delete when only the Storage cleanup fails', async () => {
    harness.errors['storage.remove'] = { message: 'storage unavailable' };

    await expect(DocumentRepository.deleteDocument('d1', 'ws/d1.pdf')).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalled();
  });

  it('treats an already-missing Storage object as success', async () => {
    harness.errors['storage.remove'] = { message: 'The resource was not found' };

    await expect(DocumentRepository.deleteDocument('d1', 'ws/d1.pdf')).resolves.toBeUndefined();

    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('DocumentRepository.deleteDocumentsBulk', () => {
  it('reads the paths, deletes the rows, and only then removes the files', async () => {
    harness.rows.documents = [
      { id: 'd1', file_path: 'ws/d1.pdf', thumbnail_path: null },
      { id: 'd2', file_path: 'ws/d2.pdf', thumbnail_path: 'ws/thumbs/d2.png' },
    ];

    await DocumentRepository.deleteDocumentsBulk(['d1', 'd2']);

    expect(harness.log).toEqual([
      'db:documents.select',
      'db:documents.delete',
      'storage.remove:ws/d1.pdf,ws/d2.pdf,ws/thumbs/d2.png',
    ]);
  });

  it('keeps every file when the rows cannot be deleted', async () => {
    harness.rows.documents = [{ id: 'd1', file_path: 'ws/d1.pdf', thumbnail_path: null }];
    harness.errors['documents.delete'] = { message: 'permission denied' };

    await expect(DocumentRepository.deleteDocumentsBulk(['d1'])).rejects.toMatchObject({
      message: 'permission denied',
    });

    expect(harness.log.some((entry) => entry.startsWith('storage.remove'))).toBe(false);
  });
});

describe('Realtime channels', () => {
  it('uses a unique channel name per subscription so a re-subscribe never reuses a channel that is still closing', () => {
    DocumentRepository.subscribeToDocuments('ws-a', () => undefined);
    DocumentRepository.subscribeToDocuments('ws-a', () => undefined);
    DocumentRepository.subscribeToProcessingJobs('ws-a', () => undefined);
    DocumentRepository.subscribeToProcessingJobs('ws-a', () => undefined);

    expect(new Set(harness.channelNames).size).toBe(4);
    expect(harness.channelNames.every((name) => name.includes('ws-a'))).toBe(true);
  });
});

describe('WorkspaceRepository.deleteWorkspace', () => {
  it('reads the document paths BEFORE the cascade, deletes the workspace, then removes the PDFs from Storage', async () => {
    harness.rows.documents = [
      { file_path: 'ws-a/one.pdf', thumbnail_path: null },
      { file_path: 'ws-a/two.pdf', thumbnail_path: 'ws-a/thumbs/two.png' },
    ];

    await WorkspaceRepository.deleteWorkspace('ws-a');

    expect(harness.log).toEqual([
      'db:documents.select',
      'db:workspaces.delete',
      'storage.remove:ws-a/one.pdf,ws-a/two.pdf,ws-a/thumbs/two.png',
    ]);
  });

  it('keeps every file when the workspace row cannot be deleted', async () => {
    harness.rows.documents = [{ file_path: 'ws-a/one.pdf', thumbnail_path: null }];
    harness.errors['workspaces.delete'] = { message: 'permission denied' };

    await expect(WorkspaceRepository.deleteWorkspace('ws-a')).rejects.toMatchObject({
      message: 'permission denied',
    });

    expect(harness.log.some((entry) => entry.startsWith('storage.remove'))).toBe(false);
  });

  it('still succeeds when Storage cleanup fails after the workspace is gone', async () => {
    harness.rows.documents = [{ file_path: 'ws-a/one.pdf', thumbnail_path: null }];
    harness.errors['storage.remove'] = { message: 'storage unavailable' };

    await expect(WorkspaceRepository.deleteWorkspace('ws-a')).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalled();
  });

  it('does not touch Storage for an empty workspace', async () => {
    await WorkspaceRepository.deleteWorkspace('ws-a');

    expect(harness.log).toEqual(['db:documents.select', 'db:workspaces.delete']);
  });

  it('pages through more than one API page of documents and removes files in bounded batches', async () => {
    harness.rows.documents = Array.from({ length: 1_050 }, (_, index) => ({
      file_path: `ws-a/${index}.pdf`,
      thumbnail_path: null,
    }));

    await WorkspaceRepository.deleteWorkspace('ws-a');

    expect(harness.rangeCalls).toEqual([[0, 999], [1000, 1999]]);
    const removals = harness.log.filter((entry) => entry.startsWith('storage.remove'));
    expect(removals.length).toBeGreaterThan(1);
    const removedPaths = removals.flatMap((entry) => entry.replace('storage.remove:', '').split(','));
    expect(removedPaths).toHaveLength(1_050);
    expect(removals.every((entry) => entry.split(',').length <= 100)).toBe(true);
  });
});
