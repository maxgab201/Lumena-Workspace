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

  it('checks that the document belongs to the workspace it is addressed with (ai-gateway)', () => {
    const code = source('ai-gateway');
    const documentCheckAt = code.indexOf("from('documents')");

    expect(documentCheckAt).toBeGreaterThan(-1);
    expect(code.slice(documentCheckAt, documentCheckAt + 200)).toContain(".eq('workspace_id', workspace_id)");
  });
});
