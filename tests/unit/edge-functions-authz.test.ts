import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Static guardrail, NOT an integration test.
 *
 * Every user-facing Edge Function authenticates the caller and then works with the
 * service-role client, which bypasses RLS, keyed on a workspace_id that the CLIENT sent.
 * The only thing standing between one user and another workspace's data, quota and credits
 * is an explicit `workspace_members` lookup. `ai-gateway` shipped without one.
 *
 * This asserts that each function performs that lookup, and does it BEFORE it touches any
 * workspace-scoped resource. It cannot prove the check is correct: exercise the deployed
 * functions with a token from a user who is not a member for that.
 */
const USER_FACING = [
  'ai-gateway',
  'ai-highlight',
  'create-highlights',
  'ai-config',
  'generate-knowledge',
  'rag-retrieve',
  'create-checkout-session',
] as const;

/** Workspace-scoped resources that must not be reached before membership is verified. */
const WORKSPACE_SCOPED_MARKERS = [
  "rpc('consume_ai_request'",
  "rpc('consume_ai_quota_run_page'",
  "from('credit_accounts')",
  "from('credit_ledger')",
  "from('usage_jobs')",
  "from('rate_limit_counters')",
  "from('subscriptions')",
  "from('purchases')",
  "from('document_embeddings')",
  "from('document_chunks')",
  'resolvePlan(',
  'hybrid_search',
];

const source = (fn: string) =>
  readFileSync(resolve(__dirname, `../../supabase/functions/${fn}/index.ts`), 'utf8');

describe('Edge Functions verify workspace membership before using workspace data', () => {
  it.each(USER_FACING)('%s', (fn) => {
    const code = source(fn);
    const membershipAt = code.indexOf("from('workspace_members')");

    expect(membershipAt, `${fn} must look the caller up in workspace_members`).toBeGreaterThan(-1);

    // Helpers declared above the request handler only run once the handler calls them.
    const handlerAt = Math.max(code.indexOf('serve('), 0);
    for (const marker of WORKSPACE_SCOPED_MARKERS) {
      const usedAt = code.indexOf(marker, handlerAt);
      if (usedAt !== -1) {
        expect(
          membershipAt,
          `${fn}: "${marker}" is reached before the membership check`,
        ).toBeLessThan(usedAt);
      }
    }
  });

  /**
   * Membership in the workspace the client NAMED proves nothing about the document_id it also
   * sent. These functions read `documents` as service_role (RLS never sees the query), so a
   * member of any workspace could address another workspace's document and get its text back.
   * `generate-knowledge` shipped without this and was reachable from the Knowledge sidebar.
   */
  const READS_DOCUMENTS_AS_SERVICE_ROLE = [
    'ai-gateway',
    'ai-highlight',
    'create-highlights',
    'generate-knowledge',
  ] as const;

  it.each(READS_DOCUMENTS_AS_SERVICE_ROLE)('%s checks that the document belongs to the workspace it is addressed with', (fn) => {
    const code = source(fn);
    const documentLookupAt = code.indexOf("from('documents')");

    expect(documentLookupAt, `${fn} must look the document up`).toBeGreaterThan(-1);

    // Either the query chain itself filters by workspace, or the returned row is compared to it.
    // The chain is matched as a unit (not a character window) so that a later query, such as the
    // credit account lookup, cannot satisfy the check by accident.
    const fromLookup = code.slice(documentLookupAt);
    const queryChain = fromLookup.match(/^from\('documents'\)(?:\s*\.\w+\([^)]*\))*/)?.[0] ?? '';
    const filteredInQuery = /\.eq\('workspace_id',\s*\w+\)/.test(queryChain);
    const rowCompared = /\bdoc\??\.workspace_id\s*!==\s*\w+/.test(fromLookup);

    expect(
      filteredInQuery || rowCompared,
      `${fn}: the document lookup is not scoped to the workspace the caller proved membership of`,
    ).toBe(true);
  });

  it('every Edge Function that reads documents by a client-supplied id is covered above', () => {
    // A new user-facing function that reads `documents` must be added to the list, not skipped.
    const covered = new Set<string>([...READS_DOCUMENTS_AS_SERVICE_ROLE, 'process-document', 'rag-retrieve']);
    const reading = USER_FACING.filter((fn) => source(fn).includes("from('documents')"));
    for (const fn of reading) {
      expect(covered.has(fn), `${fn} reads documents but is not in the document-scope guardrail`).toBe(true);
    }
  });
});
