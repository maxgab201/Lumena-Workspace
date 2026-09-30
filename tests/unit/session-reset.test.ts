import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { useUserStore } from '../../src/stores/userStore';
import { useWorkspaceStore } from '../../src/stores/workspaceStore';
import { useChatStore } from '../../src/stores/chatStore';
import { useHighlightStore } from '../../src/stores/highlightStore';
import { useKnowledgeStore } from '../../src/stores/knowledgeStore';
import { useBillingStore } from '../../src/stores/billingStore';
import { useViewerStore } from '../../src/stores/viewerStore';
import { useUiStore } from '../../src/stores/uiStore';
import { supabase } from '../../src/lib/supabase';

vi.mock('../../src/repositories/auth.repository', () => ({
  AuthRepository: {
    getUser: vi.fn().mockResolvedValue(null),
    signOut: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/repositories/document.repository', () => ({
  DocumentRepository: {
    listDocuments: vi.fn().mockResolvedValue([]),
    listProcessingJobs: vi.fn().mockResolvedValue([]),
    reapStaleProcessingJobs: vi.fn().mockResolvedValue(0),
    subscribeToProcessingJobs: vi.fn(() => ({ unsubscribe: vi.fn() })),
    subscribeToDocuments: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
}));

const workspace = { id: 'ws-user-1', name: 'Private workspace of user 1', created_at: '2026-01-01T00:00:00.000Z' };

/** Fill every per-user store with data that belongs to "user 1". */
function seedUserOneData() {
  const unsubscribe = vi.fn();
  useWorkspaceStore.setState({
    workspaces: [workspace],
    activeWorkspace: workspace,
    documents: [{
      id: 'doc-1', workspace_id: workspace.id, name: 'secret-plan.pdf', size_bytes: 10,
      status: 'ready', file_path: 'ws-user-1/doc-1.pdf', created_at: '2026-01-01T00:00:00.000Z',
    }] as never,
    _subscriptions: [{ unsubscribe }],
  });
  useChatStore.setState({
    sessions: { 'doc-1': { id: 's1', document_id: 'doc-1', workspace_id: workspace.id } as never },
    messages: { s1: [{ id: 'm1', role: 'user', content: 'confidential question' } as never] },
    activeSessionId: 's1',
  });
  useBillingStore.setState({ account: { available: 900, reserved: 0, consumed: 100, expired: 0 } });
  useViewerStore.setState({ documentId: 'doc-1', currentPage: 7 });
  return { unsubscribe };
}

function expectNothingOfUserOneRemains(unsubscribe: Mock) {
  expect(useWorkspaceStore.getState().activeWorkspace).toBeNull();
  expect(useWorkspaceStore.getState().workspaces).toEqual([]);
  expect(useWorkspaceStore.getState().documents).toEqual([]);
  expect(useWorkspaceStore.getState()._subscriptions).toEqual([]);
  expect(unsubscribe).toHaveBeenCalled();
  expect(useChatStore.getState().messages).toEqual({});
  expect(useChatStore.getState().activeSessionId).toBeNull();
  expect(useBillingStore.getState().account).toBeNull();
  expect(useViewerStore.getState().documentId).toBeNull();
}

/** The listener `initialize()` registers with supabase-js. */
function authListener() {
  const onAuthStateChange = supabase.auth.onAuthStateChange as unknown as Mock;
  return onAuthStateChange.mock.calls.at(-1)![0] as (event: string, session: unknown) => Promise<void>;
}

const sessionFor = (id: string) => ({ user: { id, email: `${id}@example.com` } });

/** `initialize()` also fires an async `getUser()`; let it settle before emitting auth events. */
async function startAuth() {
  useUserStore.getState().initialize();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  useUserStore.setState(useUserStore.getInitialState(), true);
  useUiStore.setState({ loadSettings: vi.fn().mockResolvedValue(undefined) });
  useHighlightStore.setState(useHighlightStore.getInitialState(), true);
  useKnowledgeStore.setState(useKnowledgeStore.getInitialState(), true);
});

describe('session isolation between accounts', () => {
  it('drops every per-user cache on sign-out, so the next account cannot see the previous one', async () => {
    useUserStore.setState({ user: { id: 'user-1' } as never, loading: false });
    const { unsubscribe } = seedUserOneData();

    await useUserStore.getState().signOut();

    expectNothingOfUserOneRemains(unsubscribe);
  });

  it('resets when the session ends elsewhere (expired token, sign-out in another tab)', async () => {
    await startAuth();
    await authListener()('SIGNED_IN', sessionFor('user-1'));
    const { unsubscribe } = seedUserOneData();

    await authListener()('SIGNED_OUT', null);

    expectNothingOfUserOneRemains(unsubscribe);
    expect(useUserStore.getState().user).toBeNull();
  });

  it('resets when a DIFFERENT account signs in without a page reload', async () => {
    await startAuth();
    await authListener()('SIGNED_IN', sessionFor('user-1'));
    const { unsubscribe } = seedUserOneData();

    await authListener()('SIGNED_IN', sessionFor('user-2'));

    expectNothingOfUserOneRemains(unsubscribe);
    expect(useUserStore.getState().user?.id).toBe('user-2');
  });

  it('keeps everything when the SAME account only refreshes its token', async () => {
    await startAuth();
    await authListener()('SIGNED_IN', sessionFor('user-1'));
    seedUserOneData();

    await authListener()('TOKEN_REFRESHED', sessionFor('user-1'));

    expect(useWorkspaceStore.getState().activeWorkspace?.id).toBe('ws-user-1');
    expect(useChatStore.getState().activeSessionId).toBe('s1');
    expect(useBillingStore.getState().account?.available).toBe(900);
  });

  it('does not refetch the profile for an event of the account that is already loaded', async () => {
    await startAuth();
    await authListener()('SIGNED_IN', sessionFor('user-1'));
    (supabase.from as unknown as Mock).mockClear();

    await authListener()('TOKEN_REFRESHED', sessionFor('user-1'));

    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('user settings after signing in', () => {
  it('loads the saved settings when an account signs in (App only loaded them once, at mount)', async () => {
    await startAuth();

    await authListener()('SIGNED_IN', sessionFor('user-1'));

    expect(useUiStore.getState().loadSettings).toHaveBeenCalledTimes(1);
  });

  it('loads the new account\'s settings when the account changes', async () => {
    await startAuth();
    await authListener()('SIGNED_IN', sessionFor('user-1'));
    (useUiStore.getState().loadSettings as Mock).mockClear();

    await authListener()('SIGNED_IN', sessionFor('user-2'));

    expect(useUiStore.getState().loadSettings).toHaveBeenCalledTimes(1);
  });

  it('does not reload settings for a repeated SIGNED_IN of the same account (tab refocus)', async () => {
    await startAuth();
    await authListener()('SIGNED_IN', sessionFor('user-1'));
    (useUiStore.getState().loadSettings as Mock).mockClear();

    await authListener()('SIGNED_IN', sessionFor('user-1'));

    expect(useUiStore.getState().loadSettings).not.toHaveBeenCalled();
  });

  it('does not reload settings for the initial session restored from storage (App already loads them)', async () => {
    await startAuth();

    await authListener()('INITIAL_SESSION', sessionFor('user-1'));

    expect(useUiStore.getState().loadSettings).not.toHaveBeenCalled();
  });
});
