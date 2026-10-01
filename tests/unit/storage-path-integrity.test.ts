import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Production audit (2026-10-01): move_document_workspace stored whatever p_new_file_path it was
 * given, and the documents UPDATE policy has no column restriction, so a member could point a
 * document at ANOTHER workspace's Storage prefix; process-document then downloads that path with
 * the service-role key (Storage RLS does not apply). The database now refuses it with a CHECK
 * constraint; this pins the constraint in the migrations and pins that the client never builds a
 * path outside the target workspace.
 */

const harness = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  moves: [] as Array<[string, string]>,
}));

vi.mock('../../src/config/env', () => ({
  env: { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'test-anon-key-123' },
}));

vi.mock('../../src/lib/supabase', () => {
  const docs = [
    { id: 'doc-1', workspace_id: 'ws-source', file_path: 'ws-source/abc123.pdf', file_hash: 'abc123' },
  ];
  function builder(table: string) {
    let single = false;
    const api: Record<string, unknown> = {
      select: () => api,
      in: () => api,
      eq: () => api,
      order: () => api,
      limit: () => api,
      maybeSingle: () => { single = true; return api; },
      then: (resolve: (value: unknown) => unknown) => {
        // the lookup by id returns the rows; the duplicate lookup (maybeSingle) finds none
        const data = single ? null : table === 'documents' ? docs : null;
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return api;
  }
  return {
    supabase: {
      from: (table: string) => builder(table),
      storage: {
        from: () => ({
          move: async (from: string, to: string) => {
            harness.moves.push([from, to]);
            return { data: {}, error: null };
          },
        }),
      },
      rpc: async (fn: string, args: Record<string, unknown>) => {
        harness.rpcCalls.push({ fn, args });
        return { data: null, error: null };
      },
    },
  };
});

import { DocumentRepository } from '../../src/repositories/document.repository';

beforeEach(() => {
  harness.rpcCalls = [];
  harness.moves = [];
});

describe('document file_path stays inside its workspace prefix', () => {
  it('the database refuses a file_path outside the document\'s workspace (CHECK constraint)', () => {
    const dir = resolve(__dirname, '../../supabase/migrations');
    const sql = readdirSync(dir)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => readFileSync(resolve(dir, file), 'utf8'))
      .join('\n');

    expect(sql).toMatch(/add constraint documents_file_path_in_workspace_prefix/i);
    expect(sql).toMatch(/check\s*\(\s*file_path like workspace_id::text \|\| '\/%'\s*\)/i);
  });

  it('moving a document asks for a path under the TARGET workspace, in Storage and in the RPC', async () => {
    const moved = await DocumentRepository.moveDocumentsBulk(['doc-1'], 'ws-target');

    expect(moved).toEqual(['doc-1']);
    expect(harness.moves).toEqual([['ws-source/abc123.pdf', 'ws-target/abc123.pdf']]);
    expect(harness.rpcCalls).toHaveLength(1);
    expect(harness.rpcCalls[0].fn).toBe('move_document_workspace');
    expect(harness.rpcCalls[0].args).toMatchObject({
      p_document_id: 'doc-1',
      p_target_workspace_id: 'ws-target',
      p_new_file_path: 'ws-target/abc123.pdf',
    });
  });

  it('keeps only the file name of the source path, so a crafted source path cannot escape the target prefix', async () => {
    vi.resetModules();
    const { DocumentRepository: Fresh } = await import('../../src/repositories/document.repository');
    // the harness returns ws-source/abc123.pdf; the target path is rebuilt from the last segment only
    await Fresh.moveDocumentsBulk(['doc-1'], 'ws-target');
    const path = String(harness.rpcCalls.at(-1)?.args.p_new_file_path);
    expect(path.startsWith('ws-target/')).toBe(true);
    expect(path.split('/')).toHaveLength(2);
  });
});

describe('describeUploadFailure', () => {
  // Real response of Storage when two tabs upload the same file at the same moment (production, QA account).
  const duplicate = JSON.stringify({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });

  it('says a file that lost the race for its path is already in the workspace', async () => {
    const { describeUploadFailure } = await import('../../src/repositories/document.repository');
    expect(describeUploadFailure(400, duplicate, 'report.pdf')).toBe('“report.pdf” is already in this workspace.');
    expect(describeUploadFailure(409, duplicate)).toBe('“This file” is already in this workspace.');
  });

  it('keeps Storage\'s own message for other refusals, and falls back to the status', async () => {
    const { describeUploadFailure } = await import('../../src/repositories/document.repository');
    expect(describeUploadFailure(403, JSON.stringify({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }))).toBe('new row violates row-level security policy');
    expect(describeUploadFailure(413, '<html>too large</html>')).toBe('Upload failed (413)');
    expect(describeUploadFailure(500, '')).toBe('Upload failed (500)');
  });
});
