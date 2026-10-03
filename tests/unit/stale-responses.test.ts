import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useChatStore } from '../../src/stores/chatStore';
import { useHighlightStore } from '../../src/stores/highlightStore';
import { useKnowledgeStore } from '../../src/stores/knowledgeStore';
import { useWorkspaceStore } from '../../src/stores/workspaceStore';
import { useBillingStore } from '../../src/stores/billingStore';
import { useViewerStore } from '../../src/stores/viewerStore';
import { resetUserScopedState } from '../../src/stores/sessionReset';
import { ChatRepository } from '../../src/repositories/chat.repository';
import { HighlightRepository } from '../../src/repositories/highlight.repository';
import { KnowledgeRepository } from '../../src/repositories/knowledge.repository';
import { DocumentRepository } from '../../src/repositories/document.repository';
import { WorkspaceRepository } from '../../src/repositories/workspace.repository';
import { BillingRepository } from '../../src/repositories/billing.repository';
import type { Highlight } from '../../src/types/highlights';

/**
 * Production evidence (real browser, real QA login): open document A, go back and open document B while
 * A's chat session is still loading. A's slow answer arrives after B's and set the active chat session,
 * so B's panel showed A's conversation (and a message sent there would have been saved in A's session).
 *
 * The same shape threatens every store loader: an answer that comes back after the user moved on (another
 * document, another workspace, signed out) must not be written over what is on screen.
 */
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../src/repositories/chat.repository', () => ({
  ChatRepository: { getOrCreateSession: vi.fn(), getMessages: vi.fn(), addMessage: vi.fn(), updateMessage: vi.fn() },
}));
vi.mock('../../src/repositories/highlight.repository', () => ({
  HighlightRepository: {
    listHighlights: vi.fn(), listCategories: vi.fn(), createHighlight: vi.fn(), updateHighlight: vi.fn(), deleteHighlight: vi.fn(),
  },
}));
vi.mock('../../src/repositories/knowledge.repository', () => ({ KnowledgeRepository: { loadAllForDocument: vi.fn() } }));
vi.mock('../../src/repositories/workspace.repository', () => ({ WorkspaceRepository: { listWorkspaces: vi.fn(), createWorkspace: vi.fn() } }));
vi.mock('../../src/repositories/billing.repository', () => ({
  BillingRepository: { getSubscription: vi.fn(), getCreditAccount: vi.fn(), getLedgerEntries: vi.fn(), getCreditPackages: vi.fn() },
}));
vi.mock('../../src/repositories/document.repository', () => ({
  DocumentRepository: {
    listDocuments: vi.fn(), listProcessingJobs: vi.fn(), reapStaleProcessingJobs: vi.fn().mockResolvedValue(0),
    subscribeToProcessingJobs: vi.fn(() => ({ unsubscribe: vi.fn() })), subscribeToDocuments: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
}));

/** A promise the test settles by hand, to control which answer arrives first. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const session = (documentId: string) => ({ id: `session-${documentId}`, document_id: documentId, workspace_id: 'ws-1', user_id: 'u1' });
const ws = (id: string) => ({ id, name: id.toUpperCase(), created_at: '2026-01-01T00:00:00.000Z' });

beforeEach(() => {
  vi.clearAllMocks();
  resetUserScopedState();
});

describe('chat: the session of the document on screen wins, whatever order the answers arrive in', () => {
  it('a slow answer for the document the user already left does not become the active session', async () => {
    const slowA = deferred<ReturnType<typeof session>>();
    vi.mocked(ChatRepository.getOrCreateSession).mockImplementation((documentId: string) =>
      documentId === 'doc-A' ? (slowA.promise as never) : (Promise.resolve(session(documentId)) as never));
    vi.mocked(ChatRepository.getMessages).mockImplementation(((sessionId: string) =>
      Promise.resolve([{ id: `m-${sessionId}`, session_id: sessionId, role: 'user', content: `chat of ${sessionId}` }])) as never);

    const loadA = useChatStore.getState().loadSession('doc-A', 'ws-1');
    await useChatStore.getState().loadSession('doc-B', 'ws-1'); // the user is on B now
    expect(useChatStore.getState().activeSessionId).toBe('session-doc-B');

    slowA.resolve(session('doc-A'));
    await loadA;

    expect(useChatStore.getState().activeSessionId).toBe('session-doc-B');
    expect(useChatStore.getState().getActiveMessages().map((m) => m.content)).toEqual(['chat of session-doc-B']);
    expect(useChatStore.getState().isLoadingSession).toBe(false);
  });

  it('a failure of the abandoned load does not switch off the spinner of the current one', async () => {
    const failingA = deferred<ReturnType<typeof session>>();
    const slowB = deferred<ReturnType<typeof session>>();
    vi.mocked(ChatRepository.getOrCreateSession).mockImplementation((documentId: string) =>
      (documentId === 'doc-A' ? failingA.promise : slowB.promise) as never);
    vi.mocked(ChatRepository.getMessages).mockResolvedValue([] as never);

    const loadA = useChatStore.getState().loadSession('doc-A', 'ws-1');
    const loadB = useChatStore.getState().loadSession('doc-B', 'ws-1');
    failingA.reject(new Error('network'));
    await loadA;
    expect(useChatStore.getState().isLoadingSession).toBe(true); // B is still loading

    slowB.resolve(session('doc-B'));
    await loadB;
    expect(useChatStore.getState().isLoadingSession).toBe(false);
    expect(useChatStore.getState().activeSessionId).toBe('session-doc-B');
  });
});

describe('answers that arrive after the session ended or the account changed are dropped', () => {
  it('workspaces: a late list does not make the next account inherit a workspace', async () => {
    const late = deferred<unknown[]>();
    vi.mocked(WorkspaceRepository.listWorkspaces).mockReturnValue(late.promise as never);
    const fetching = useWorkspaceStore.getState().fetchWorkspaces();

    resetUserScopedState(); // sign-out / another account
    late.resolve([ws('previous-account-ws')]);
    await fetching;

    expect(useWorkspaceStore.getState().workspaces).toEqual([]);
    expect(useWorkspaceStore.getState().activeWorkspace).toBeNull();
    expect(DocumentRepository.listDocuments).not.toHaveBeenCalled();
  });

  it('workspace creation: a response after sign-out does not activate the previous account workspace', async () => {
    const late = deferred<ReturnType<typeof ws>>();
    vi.mocked(WorkspaceRepository.createWorkspace).mockReturnValue(late.promise as never);
    vi.mocked(DocumentRepository.listDocuments).mockResolvedValue([] as never);
    vi.mocked(DocumentRepository.listProcessingJobs).mockResolvedValue([] as never);
    const creating = useWorkspaceStore.getState().createWorkspace('previous account');

    resetUserScopedState(); // the request is still in flight when the session ends
    const currentAccountWorkspace = ws('current-account-ws');
    useWorkspaceStore.setState({ workspaces: [currentAccountWorkspace], activeWorkspace: currentAccountWorkspace });
    late.resolve(ws('previous-account-ws'));
    await creating;

    expect(useWorkspaceStore.getState().workspaces).toEqual([currentAccountWorkspace]);
    expect(useWorkspaceStore.getState().activeWorkspace).toEqual(currentAccountWorkspace);
    expect(DocumentRepository.listDocuments).not.toHaveBeenCalled();
  });

  it('documents: a late document list is not written into the store', async () => {
    const late = deferred<unknown[]>();
    useWorkspaceStore.setState({ activeWorkspace: ws('w1') });
    vi.mocked(DocumentRepository.listDocuments).mockReturnValue(late.promise as never);
    vi.mocked(DocumentRepository.listProcessingJobs).mockResolvedValue([] as never);
    const fetching = useWorkspaceStore.getState().fetchDocuments('w1');

    resetUserScopedState();
    // a second account now has the same workspace id active (e.g. a shared one)
    useWorkspaceStore.setState({ activeWorkspace: ws('w1') });
    late.resolve([{ id: 'secret', workspace_id: 'w1', name: 'previous-account.pdf', size_bytes: 1, status: 'ready', file_path: 'w1/x.pdf', created_at: '2026-01-01' }]);
    await fetching;

    expect(useWorkspaceStore.getState().documents).toEqual([]);
  });

  it('highlights: a late list does not come back after the reset', async () => {
    const late = deferred<Highlight[]>();
    vi.mocked(HighlightRepository.listHighlights).mockReturnValue(late.promise as never);
    const loading = useHighlightStore.getState().loadHighlights('doc-A');

    resetUserScopedState();
    late.resolve([{ id: 'h1', document_id: 'doc-A', text: 'previous account highlight' } as Highlight]);
    await loading;

    expect(useHighlightStore.getState().highlights).toEqual({});
  });

  it('categories: a late workspace load does not replace the categories for the workspace now on screen', async () => {
    const lateA = deferred<Array<{ id: string; name: string }>>();
    const currentB = [{ id: 'category-B', name: 'B category' }];
    vi.mocked(HighlightRepository.listCategories).mockImplementation((workspaceId: string) =>
      (workspaceId === 'workspace-A' ? lateA.promise : Promise.resolve(currentB)) as never);

    const loadingA = useHighlightStore.getState().loadCategories('workspace-A');
    await useHighlightStore.getState().loadCategories('workspace-B');
    lateA.resolve([{ id: 'category-A', name: 'A category' }]);
    await loadingA;

    expect(useHighlightStore.getState().categories).toEqual(currentB);
  });

  it('highlight creation: a response after sign-out does not repopulate the previous account highlight', async () => {
    const late = deferred<Highlight>();
    vi.mocked(HighlightRepository.createHighlight).mockReturnValue(late.promise as never);
    const adding = useHighlightStore.getState().addHighlight({
      document_id: 'previous-doc', workspace_id: 'previous-ws', page_index: 0, rects: [], text: 'private note', color: '#fff',
    });

    resetUserScopedState();
    late.resolve({ id: 'previous-highlight', document_id: 'previous-doc', text: 'private note' } as Highlight);
    await adding;

    expect(useHighlightStore.getState().highlights).toEqual({});
  });

  it('highlight rollback: a delete failure after sign-out does not restore the previous account highlight', async () => {
    const late = deferred<void>();
    const previous = { id: 'previous-highlight', document_id: 'previous-doc', text: 'private note' } as Highlight;
    useHighlightStore.setState({ highlights: { 'previous-doc': [previous] }, activeHighlightId: 'previous-highlight' });
    vi.mocked(HighlightRepository.deleteHighlight).mockReturnValue(late.promise as never);
    const removing = useHighlightStore.getState().removeHighlight('previous-highlight');

    resetUserScopedState();
    late.reject(new Error('offline'));
    await removing;

    expect(useHighlightStore.getState().highlights).toEqual({});
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('chat fallback: a session lookup that resolves after sign-out cannot become active', async () => {
    const late = deferred<ReturnType<typeof session>>();
    vi.mocked(ChatRepository.getOrCreateSession).mockReturnValue(late.promise as never);
    vi.mocked(ChatRepository.addMessage).mockRejectedValue(new Error('should not send after sign-out'));
    useViewerStore.setState({ documentId: 'previous-doc' } as never);
    useWorkspaceStore.setState({ activeWorkspace: ws('previous-ws') });
    const sending = useChatStore.getState().sendMessage('hello');

    resetUserScopedState();
    late.resolve(session('previous-doc'));
    await sending;

    expect(useChatStore.getState().activeSessionId).toBeNull();
    expect(ChatRepository.addMessage).not.toHaveBeenCalled();
  });

  it('chat send: a message request that resolves after sign-out cannot start the next request', async () => {
    const lateUserMessage = deferred<unknown>();
    vi.mocked(ChatRepository.addMessage).mockImplementation((( _sessionId: string, role: string) =>
      role === 'user' ? lateUserMessage.promise : Promise.reject(new Error('should not create an assistant message after sign-out'))) as never);
    useChatStore.setState({ activeSessionId: 'session-previous-doc' });
    const sending = useChatStore.getState().sendMessage('private message');

    resetUserScopedState();
    lateUserMessage.resolve({ id: 'previous-user-message', session_id: 'session-previous-doc', role: 'user', content: 'private message' });
    await sending;

    expect(ChatRepository.addMessage).toHaveBeenCalledTimes(1);
    expect(useChatStore.getState().activeSessionId).toBeNull();
    expect(useChatStore.getState().messages).toEqual({});
    expect(useChatStore.getState().isGenerating).toBe(false);
  });

  it('knowledge: late flashcards do not come back after the reset', async () => {
    const late = deferred<Record<string, unknown[]>>();
    vi.mocked(KnowledgeRepository.loadAllForDocument).mockReturnValue(late.promise as never);
    const loading = useKnowledgeStore.getState().loadKnowledge('doc-A');

    resetUserScopedState();
    late.resolve({ flashcards: [{ id: 'f1' }], glossaryTerms: [], mindMapNodes: [], timelineEvents: [], presentations: [] });
    await loading;

    expect(useKnowledgeStore.getState().flashcards).toEqual({});
  });

  it('chat: a late session does not come back after the reset', async () => {
    const late = deferred<ReturnType<typeof session>>();
    vi.mocked(ChatRepository.getOrCreateSession).mockReturnValue(late.promise as never);
    vi.mocked(ChatRepository.getMessages).mockResolvedValue([{ id: 'm', content: 'confidential' }] as never);
    const loading = useChatStore.getState().loadSession('doc-A', 'ws-1');

    resetUserScopedState();
    late.resolve(session('doc-A'));
    await loading;

    expect(useChatStore.getState().activeSessionId).toBeNull();
    expect(useChatStore.getState().messages).toEqual({});
  });

  it('billing: the credits of a workspace the user left are not shown for the new one', async () => {
    const slowAccount = deferred<{ available: number; reserved: number; consumed: number; expired: number }>();
    useWorkspaceStore.setState({ activeWorkspace: ws('w1') });
    vi.mocked(BillingRepository.getSubscription).mockResolvedValue(null as never);
    vi.mocked(BillingRepository.getCreditAccount).mockReturnValue(slowAccount.promise as never);
    vi.mocked(BillingRepository.getLedgerEntries).mockResolvedValue([] as never);
    vi.mocked(BillingRepository.getCreditPackages).mockResolvedValue([] as never);
    const fetching = useBillingStore.getState().fetchBillingData();

    useWorkspaceStore.setState({ activeWorkspace: ws('w2') }); // switched workspace meanwhile
    slowAccount.resolve({ available: 900, reserved: 0, consumed: 0, expired: 0 });
    await fetching;

    expect(useBillingStore.getState().account).toBeNull();
  });
});

describe('highlights: a failed save only undoes its own change', () => {
  const highlight = (id: string, text = id): Highlight => ({
    id, document_id: 'doc-1', workspace_id: 'ws-1', page_index: 0, rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.02 }],
    // distinct, increasing creation times (A < B < C < NEW), like real rows
    text, color: '#fef08a', category_id: null, note: null, created_at: `2026-01-01T00:00:${String(id.charCodeAt(0) % 60).padStart(2, '0')}Z`, updated_at: '2026-01-01T00:00:00Z',
  } as unknown as Highlight);
  const ids = () => useHighlightStore.getState().highlights['doc-1']?.map((h) => h.id);

  beforeEach(() => {
    useHighlightStore.setState({ highlights: { 'doc-1': [highlight('A'), highlight('B'), highlight('C')] }, activeHighlightId: null });
  });

  it('three deletes that all fail while offline bring all three back, in their place', async () => {
    vi.mocked(HighlightRepository.deleteHighlight).mockRejectedValue(new Error('offline'));
    const { removeHighlight } = useHighlightStore.getState();
    await Promise.all([removeHighlight('A'), removeHighlight('B'), removeHighlight('C')]);
    expect(ids()).toEqual(['A', 'B', 'C']);
    expect(toast.error).toHaveBeenCalledTimes(3);
  });

  it('a delete that fails does not erase a highlight created while it was in flight', async () => {
    const failing = deferred<void>();
    vi.mocked(HighlightRepository.deleteHighlight).mockReturnValue(failing.promise as never);
    vi.mocked(HighlightRepository.createHighlight).mockImplementation((async (data: Record<string, unknown>) => ({ ...highlight('NEW'), ...data, id: 'NEW' })) as never);

    const removing = useHighlightStore.getState().removeHighlight('B');
    await useHighlightStore.getState().addHighlight({ document_id: 'doc-1', workspace_id: 'ws-1', page_index: 0, rects: [], text: 'new', color: '#fff' });
    failing.reject(new Error('offline'));
    await removing;

    expect(ids()).toEqual(['A', 'B', 'C', 'NEW']);
  });

  it('a failed delete keeps a delete that succeeded meanwhile', async () => {
    const failing = deferred<void>();
    vi.mocked(HighlightRepository.deleteHighlight).mockImplementation(((id: string) => (id === 'A' ? failing.promise : Promise.resolve())) as never);

    const removingA = useHighlightStore.getState().removeHighlight('A');
    await useHighlightStore.getState().removeHighlight('C'); // succeeds
    failing.reject(new Error('offline'));
    await removingA;

    expect(ids()).toEqual(['A', 'B']);
  });

  it('a failed edit restores only the fields it changed, while another edit is still in flight', async () => {
    const failingNote = deferred<Highlight>();
    const pendingColor = deferred<Highlight>();
    vi.mocked(HighlightRepository.updateHighlight).mockImplementation(((_id: string, updates: Record<string, unknown>) =>
      (updates.note !== undefined ? failingNote.promise : pendingColor.promise)) as never);

    const editingNote = useHighlightStore.getState().updateHighlight('A', { note: 'my note' });
    const editingColor = useHighlightStore.getState().updateHighlight('A', { color: '#bbf7d0' });
    failingNote.reject(new Error('offline'));
    await editingNote;

    // the note edit is undone, the colour edit (still being saved) keeps showing what the user chose
    const a = () => useHighlightStore.getState().highlights['doc-1'].find((h) => h.id === 'A')!;
    expect(a().note).toBeNull();
    expect(a().color).toBe('#bbf7d0');

    pendingColor.resolve({ ...highlight('A'), color: '#bbf7d0' });
    await editingColor;
    expect(a().color).toBe('#bbf7d0');
    expect(a().note).toBeNull();
  });

  it('a highlight a refresh already brought in is not added a second time when its own save returns', async () => {
    vi.mocked(HighlightRepository.createHighlight).mockImplementation((async () => {
      // the user comes back to the tab while this save is in flight: the refresh lists the new row already
      useHighlightStore.setState({ highlights: { 'doc-1': [highlight('A'), highlight('B'), highlight('C'), highlight('NEW')] } });
      return highlight('NEW');
    }) as never);

    await useHighlightStore.getState().addHighlight({ document_id: 'doc-1', workspace_id: 'ws-1', page_index: 0, rects: [], text: 'new', color: '#fff' });

    expect(ids()).toEqual(['A', 'B', 'C', 'NEW']);
  });

  it('a failed delete of the active highlight makes it active again', async () => {
    vi.mocked(HighlightRepository.deleteHighlight).mockRejectedValue(new Error('offline'));
    useHighlightStore.setState({ activeHighlightId: 'B' });
    await useHighlightStore.getState().removeHighlight('B');
    expect(useHighlightStore.getState().activeHighlightId).toBe('B');
  });
});
