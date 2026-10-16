import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({
  supabase: { functions: { invoke: supabaseMock.invoke }, from: vi.fn(), auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() } },
}));

vi.mock('../../src/config/env', () => ({ env: { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon-key-for-tests' } }));

import { readFunctionError } from '../../src/lib/functionError';
import { BillingRepository } from '../../src/repositories/billing.repository';
import { useBillingStore } from '../../src/stores/billingStore';
import { useKnowledgeStore } from '../../src/stores/knowledgeStore';
import { useWorkspaceStore } from '../../src/stores/workspaceStore';

/**
 * supabase-js reports ANY non-2xx answer of an Edge Function as a FunctionsHttpError whose message is always
 * "Edge Function returned a non-2xx status code". What the function actually said ({"error": "...", "code": "..."})
 * is only in `error.context`, a Response nobody had read: a user with no credits saw that generic sentence, and the
 * billing store looked for `context.code` on the Response object, so its "payments are not available yet" notice
 * could never appear.
 */
const GENERIC = 'Edge Function returned a non-2xx status code';
function httpError(status: number, body: unknown) {
  return Object.assign(new Error(GENERIC), {
    name: 'FunctionsHttpError',
    context: new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  });
}

describe('readFunctionError', () => {
  it('returns what the function said: message, machine-readable code and HTTP status', async () => {
    const details = await readFunctionError(httpError(503, { error: 'Payments are not available yet.', code: 'stripe_not_configured' }));

    expect(details).toEqual({ message: 'Payments are not available yet.', code: 'stripe_not_configured', status: 503 });
  });

  it('does not use up the response body, so another reader can still read it', async () => {
    const error = httpError(402, { error: 'Insufficient credits for knowledge generation.' });

    await readFunctionError(error);

    expect(await (error.context as Response).json()).toEqual({ error: 'Insufficient credits for knowledge generation.' });
  });

  it('falls back to the error message when the body is not JSON or has no message', async () => {
    expect((await readFunctionError(httpError(502, '<html>Bad gateway</html>'))).message).toBe(GENERIC);
    expect((await readFunctionError(httpError(500, { detail: 'x' }))).message).toBe(GENERIC);
  });

  it('copes with errors that carry no response at all (network failure, plain Error, nothing)', async () => {
    expect(await readFunctionError(new Error('Failed to fetch'))).toEqual({ message: 'Failed to fetch' });
    expect((await readFunctionError(undefined)).message).toBeTruthy();
    expect((await readFunctionError('boom')).message).toBeTruthy();
  });
});

describe('knowledge generation shows the reason the server gave', () => {
  beforeEach(() => {
    supabaseMock.invoke.mockReset();
    useKnowledgeStore.setState({ generationError: null, isGenerating: false } as never);
  });

  it('a workspace without credits sees "Insufficient credits", not the generic status-code sentence', async () => {
    supabaseMock.invoke.mockResolvedValue({ data: null, error: httpError(402, { error: 'Insufficient credits for knowledge generation.' }) });

    await expect(useKnowledgeStore.getState().generateFlashcards('doc-1', 'ws-1')).rejects.toThrow('Insufficient credits for knowledge generation.');

    expect(useKnowledgeStore.getState().generationError).toBe('Insufficient credits for knowledge generation.');
    expect(useKnowledgeStore.getState().isGenerating).toBe(false);
  });

  // generatePresentation is not here on purpose: while the Presentations flag is off it makes no request at all
  it.each(['generateGlossary', 'generateMindMap', 'generateTimeline'] as const)('%s too', async (action) => {
    supabaseMock.invoke.mockResolvedValue({ data: null, error: httpError(404, { error: 'Document not found' }) });

    await expect(useKnowledgeStore.getState()[action]('doc-1', 'ws-1')).rejects.toThrow('Document not found');
  });
});

describe('buying credits', () => {
  beforeEach(() => {
    supabaseMock.invoke.mockReset();
    useWorkspaceStore.setState({ activeWorkspace: { id: 'ws-1', name: 'W' } } as never);
    useBillingStore.setState({ paymentsConfigured: 'unknown', error: null, loading: false } as never);
  });

  it('sends the product the Edge Function expects ({ kind, id }), not a bare package id', async () => {
    supabaseMock.invoke.mockResolvedValue({ data: { url: null }, error: null });

    await BillingRepository.createCheckoutSession('ws-1', 'pkg-9');

    const [name, options] = supabaseMock.invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(name).toBe('create-checkout-session');
    expect(options.body.product).toEqual({ kind: 'package', id: 'pkg-9' });
    expect(options.body).not.toHaveProperty('package_id');
    expect(options.body.workspace_id).toBe('ws-1');
  });

  it('shows the honest "payments are not available yet" notice when Stripe is not configured', async () => {
    supabaseMock.invoke.mockResolvedValue({ data: null, error: httpError(503, { error: 'Payments are not available yet.', code: 'stripe_not_configured' }) });

    await useBillingStore.getState().checkoutPackage('pkg-9');

    expect(useBillingStore.getState().paymentsConfigured).toBe('no');
    expect(useBillingStore.getState().error).toBeNull();
  });

  it('tells the Billing page when a package has no Stripe price yet', async () => {
    supabaseMock.invoke.mockResolvedValue({ data: null, error: httpError(503, { error: 'This package is not available for purchase yet.', code: 'price_not_provisioned' }) });

    await expect(useBillingStore.getState().checkoutPackage('pkg-9')).rejects.toThrow('PRICE_NOT_PROVISIONED');
  });

  it('keeps the server message for any other failure', async () => {
    supabaseMock.invoke.mockResolvedValue({ data: null, error: httpError(403, { error: 'Forbidden' }) });

    await expect(useBillingStore.getState().checkoutPackage('pkg-9')).rejects.toThrow('Forbidden');
    expect(useBillingStore.getState().error).toBe('Forbidden');
  });
});
