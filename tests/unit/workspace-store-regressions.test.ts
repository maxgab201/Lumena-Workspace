import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '../../src/stores/workspaceStore';
import { DocumentRepository } from '../../src/repositories/document.repository';
import { WorkspaceRepository } from '../../src/repositories/workspace.repository';

vi.mock('../../src/repositories/workspace.repository', () => ({
  WorkspaceRepository: {
    listWorkspaces: vi.fn(),
    createWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
  },
}));

vi.mock('../../src/repositories/document.repository', () => ({
  DocumentRepository: {
    listDocuments: vi.fn(),
    listProcessingJobs: vi.fn(),
    hashFile: vi.fn(),
    findDocumentByHash: vi.fn(),
    uploadFile: vi.fn(),
    createDocumentRecord: vi.fn(),
    createProcessingJob: vi.fn(),
    deleteDocument: vi.fn(),
    removeFile: vi.fn(),
    updateDocumentStatus: vi.fn(),
    cancelActiveProcessingJobs: vi.fn(),
    reapStaleProcessingJobs: vi.fn(),
    subscribeToProcessingJobs: vi.fn(),
    subscribeToDocuments: vi.fn(),
  },
}));

const documents = vi.mocked(DocumentRepository);
const workspaces = vi.mocked(WorkspaceRepository);

const ws = (id: string) => ({ id, name: id.toUpperCase(), created_at: '2026-01-01T00:00:00.000Z' });
const doc = (id: string, workspaceId: string, extra: Record<string, unknown> = {}) => ({
  id,
  workspace_id: workspaceId,
  name: `${id}.pdf`,
  size_bytes: 1024,
  status: 'ready',
  file_path: `${workspaceId}/${id}.pdf`,
  created_at: '2026-01-01T00:00:00.000Z',
  ...extra,
});
const job = (id: string, workspaceId: string, documentId: string, status: string, progress = 0) => ({
  id,
  workspace_id: workspaceId,
  document_id: documentId,
  status,
  progress,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

/** Let pending promise chains (fetchDocuments etc.) settle. */
const flush = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const A = ws('ws-a');
const B = ws('ws-b');

beforeEach(() => {
  useWorkspaceStore.getState().cleanupSubscriptions();
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);

  documents.listDocuments.mockResolvedValue([]);
  documents.listProcessingJobs.mockResolvedValue([]);
  documents.reapStaleProcessingJobs.mockResolvedValue(0);
  documents.subscribeToProcessingJobs.mockImplementation((() => ({ unsubscribe: vi.fn() })) as never);
  documents.subscribeToDocuments.mockImplementation((() => ({ unsubscribe: vi.fn() })) as never);
  workspaces.deleteWorkspace.mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.useRealTimers();
  useWorkspaceStore.getState().cleanupSubscriptions();
});

describe('deleting a workspace', () => {
  it('switches to the next workspace, reloads ITS documents and re-subscribes when the active one is deleted', async () => {
    const docsByWorkspace: Record<string, unknown[]> = {
      'ws-a': [doc('a1', 'ws-a')],
      'ws-b': [doc('b1', 'ws-b')],
    };
    documents.listDocuments.mockImplementation((async (id: string) => docsByWorkspace[id]) as never);
    const unsubscribeA = vi.fn();
    documents.subscribeToProcessingJobs.mockImplementation(
      ((id: string) => ({ unsubscribe: id === 'ws-a' ? unsubscribeA : vi.fn() })) as never,
    );

    useWorkspaceStore.setState({ workspaces: [A, B] });
    useWorkspaceStore.getState().setActiveWorkspace(A);
    await flush();
    expect(useWorkspaceStore.getState().documents.map((d) => d.id)).toEqual(['a1']);

    await useWorkspaceStore.getState().deleteWorkspace('ws-a');
    await flush();

    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspace?.id).toBe('ws-b');
    // Previously the list kept showing the DELETED workspace's documents.
    expect(state.documents.map((d) => d.id)).toEqual(['b1']);
    expect(documents.listDocuments).toHaveBeenCalledWith('ws-b');
    // The realtime channel of the deleted workspace must be released...
    expect(unsubscribeA).toHaveBeenCalled();
    // ...and the new workspace must get its own.
    expect(documents.subscribeToDocuments).toHaveBeenLastCalledWith('ws-b', expect.any(Function));
  });

  it('leaves a clean, empty state when no workspace remains', async () => {
    documents.listDocuments.mockResolvedValue([doc('a1', 'ws-a')] as never);
    useWorkspaceStore.setState({ workspaces: [A] });
    useWorkspaceStore.getState().setActiveWorkspace(A);
    await flush();

    await useWorkspaceStore.getState().deleteWorkspace('ws-a');
    await flush();

    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspace).toBeNull();
    expect(state.workspaces).toEqual([]);
    expect(state.documents).toEqual([]);
    expect(state._subscriptions).toEqual([]);
    expect(state._pollTimer).toBeNull();
  });

  it('keeps the active workspace untouched when a different one is deleted', async () => {
    useWorkspaceStore.setState({ workspaces: [A, B] });
    useWorkspaceStore.getState().setActiveWorkspace(A);
    await flush();
    documents.listDocuments.mockClear();

    await useWorkspaceStore.getState().deleteWorkspace('ws-b');
    await flush();

    expect(useWorkspaceStore.getState().activeWorkspace?.id).toBe('ws-a');
    expect(useWorkspaceStore.getState().workspaces.map((w) => w.id)).toEqual(['ws-a']);
    expect(documents.listDocuments).not.toHaveBeenCalled();
  });
});

describe('uploading documents', () => {
  const pdf = () => new File(['%PDF-1.4'], 'queued.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    // Behave like the real backend: rows that were created are returned by later list calls,
    // otherwise the polling reconcile would (unrealistically) wipe the optimistic insert.
    const serverDocuments: Array<Record<string, unknown>> = [];
    const serverJobs: Array<Record<string, unknown>> = [];
    documents.listDocuments.mockImplementation((async (workspaceId: string) =>
      serverDocuments.filter((row) => row.workspace_id === workspaceId)) as never);
    documents.listProcessingJobs.mockImplementation((async (workspaceId: string) =>
      serverJobs.filter((row) => row.workspace_id === workspaceId)) as never);

    documents.hashFile.mockResolvedValue('hash1');
    documents.findDocumentByHash.mockResolvedValue(null);
    documents.uploadFile.mockResolvedValue({} as never);
    documents.createDocumentRecord.mockImplementation((async (record: Record<string, unknown>) => {
      const row = { id: 'new-1', status: 'processing', created_at: '2026-01-01T00:00:00.000Z', ...record };
      serverDocuments.push(row);
      return row;
    }) as never);
    documents.createProcessingJob.mockImplementation((async (workspaceId: string, documentId: string) => {
      const row = job('job-1', workspaceId, documentId, 'queued');
      serverJobs.push(row);
      return row;
    }) as never);
  });

  it('uploads into the workspace a file was queued for, even if another one is active by the time it runs', async () => {
    useWorkspaceStore.setState({ workspaces: [A, B], activeWorkspace: B });

    await useWorkspaceStore.getState().uploadDocument(pdf(), { workspaceId: 'ws-a' });

    expect(documents.findDocumentByHash).toHaveBeenCalledWith('ws-a', 'hash1');
    expect(documents.uploadFile.mock.calls[0][0]).toBe('ws-a/hash1.pdf');
    expect(documents.createDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: 'ws-a', file_path: 'ws-a/hash1.pdf' }),
    );
    expect(documents.createProcessingJob).toHaveBeenCalledWith('ws-a', 'new-1');

    const state = useWorkspaceStore.getState();
    // The visible list belongs to workspace B: workspace A's new document must not leak into it.
    expect(state.documents.find((d) => d.id === 'new-1')).toBeUndefined();
    // And no polling loop may be started for a workspace that is not on screen.
    expect(state._pollTimer).toBeNull();
  });

  it('adds the document to the visible list and polls when the target workspace is the active one', async () => {
    useWorkspaceStore.setState({ workspaces: [A, B], activeWorkspace: A });

    await useWorkspaceStore.getState().uploadDocument(pdf());

    const state = useWorkspaceStore.getState();
    expect(state.documents.find((d) => d.id === 'new-1')).toMatchObject({ workspace_id: 'ws-a' });
    expect(state._pollTimer).not.toBeNull();
  });

  it('refuses to upload when there is neither an explicit nor an active workspace', async () => {
    await expect(useWorkspaceStore.getState().uploadDocument(pdf())).rejects.toThrow('No active workspace');
    expect(documents.uploadFile).not.toHaveBeenCalled();
  });
});

describe('status polling', () => {
  it('never starts a polling loop for a workspace that is not the active one (zombie timer)', () => {
    useWorkspaceStore.setState({ workspaces: [A, B], activeWorkspace: B });

    useWorkspaceStore.getState().startStatusPolling('ws-a');

    expect(useWorkspaceStore.getState()._pollTimer).toBeNull();
  });

  it('stops polling on its own when the user switches workspace', async () => {
    vi.useFakeTimers();
    documents.listDocuments.mockResolvedValue([doc('a1', 'ws-a', { status: 'processing' })] as never);
    documents.listProcessingJobs.mockResolvedValue([job('j1', 'ws-a', 'a1', 'extracting', 30)] as never);
    useWorkspaceStore.setState({ workspaces: [A, B], activeWorkspace: A });
    useWorkspaceStore.getState().startStatusPolling('ws-a');
    await vi.advanceTimersByTimeAsync(0);

    // Switch WITHOUT going through setActiveWorkspace (which would clean up itself).
    useWorkspaceStore.setState({ activeWorkspace: B });
    documents.listDocuments.mockClear();
    await vi.advanceTimersByTimeAsync(6_000);

    expect(useWorkspaceStore.getState()._pollTimer).toBeNull();
    expect(documents.listDocuments).not.toHaveBeenCalled();
  });

  it('keeps running the stale-job watchdog while a document stays in processing', async () => {
    vi.useFakeTimers();
    documents.listDocuments.mockResolvedValue([doc('a1', 'ws-a', { status: 'processing' })] as never);
    documents.listProcessingJobs.mockResolvedValue([job('j1', 'ws-a', 'a1', 'extracting', 30)] as never);
    useWorkspaceStore.setState({ workspaces: [A], activeWorkspace: A });

    useWorkspaceStore.getState().startStatusPolling('ws-a');
    await vi.advanceTimersByTimeAsync(0);
    const sweepsAtStart = documents.reapStaleProcessingJobs.mock.calls.length;
    expect(sweepsAtStart).toBe(1);

    // The runtime kills the Edge Function while the user watches the spinner:
    // the sweep must run again, otherwise the job spins until a page reload.
    await vi.advanceTimersByTimeAsync(130_000);

    expect(documents.reapStaleProcessingJobs.mock.calls.length).toBeGreaterThanOrEqual(sweepsAtStart + 2);
  });
});

describe('deleting a document', () => {
  it('surfaces a failed delete to the caller and keeps the document listed', async () => {
    useWorkspaceStore.setState({
      workspaces: [A],
      activeWorkspace: A,
      documents: [doc('a1', 'ws-a')] as never,
    });
    documents.deleteDocument.mockRejectedValue(new Error('permission denied'));

    await expect(useWorkspaceStore.getState().deleteDocument('a1')).rejects.toThrow('permission denied');

    expect(useWorkspaceStore.getState().documents.map((d) => d.id)).toEqual(['a1']);
    expect(useWorkspaceStore.getState().loading).toBe(false);
  });

  it('removes the document from the list on success and forwards its thumbnail for cleanup', async () => {
    useWorkspaceStore.setState({
      workspaces: [A],
      activeWorkspace: A,
      documents: [doc('a1', 'ws-a', { thumbnail_path: 'ws-a/thumbs/a1.png' })] as never,
    });
    documents.deleteDocument.mockResolvedValue(undefined as never);

    await useWorkspaceStore.getState().deleteDocument('a1');

    expect(useWorkspaceStore.getState().documents).toEqual([]);
    expect(documents.deleteDocument).toHaveBeenCalledWith('a1', 'ws-a/a1.pdf', 'ws-a/thumbs/a1.png');
  });
});
