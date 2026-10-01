import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { DocumentRepository } from '../../src/repositories/document.repository';
import { useChatStore } from '../../src/stores/chatStore';
import { useHighlightStore } from '../../src/stores/highlightStore';
import { useKnowledgeStore } from '../../src/stores/knowledgeStore';
import { Viewer } from '../../src/pages/Viewer';

/**
 * Production evidence (real browser, real QA login): open document A, go back and open document B while A's
 * metadata/chat requests are still in flight. A kept loading after the user left: it asked for its file and
 * wrote its chat session, highlights and knowledge into the shared stores, so B's chat panel showed A's
 * conversation. The reader must stop loading a document the moment it is no longer the one on screen.
 */
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../src/components/pdf/PDFViewer', () => ({
  PDFViewer: ({ fileUrl, filename }: { fileUrl: string; filename?: string }) => (
    <div data-testid="pdf" data-url={fileUrl}>{filename}</div>
  ),
}));
vi.mock('../../src/repositories/document.repository', () => ({
  DocumentRepository: {
    getDocument: vi.fn(),
    listProcessingJobs: vi.fn().mockResolvedValue([]),
    updateDocumentStatus: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const meta = (id: string) => ({
  id, name: `${id}.pdf`, size_bytes: 1024, status: 'ready', file_path: `ws-1/${id}.pdf`, workspace_id: 'ws-1', created_at: '2026-01-01T00:00:00Z',
});

const repo = vi.mocked(DocumentRepository);
const loaders = {
  loadSession: vi.fn().mockResolvedValue(undefined),
  loadHighlights: vi.fn().mockResolvedValue(undefined),
  loadCategories: vi.fn().mockResolvedValue(undefined),
  loadKnowledge: vi.fn().mockResolvedValue(undefined),
};

function mountAt(path: string) {
  const router = createMemoryRouter([{ path: '/viewer/:documentId', element: <Viewer /> }, { path: '/dashboard', element: <div>dashboard</div> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState({ loadSession: loaders.loadSession } as never);
  useHighlightStore.setState({ loadHighlights: loaders.loadHighlights, loadCategories: loaders.loadCategories } as never);
  useKnowledgeStore.setState({ loadKnowledge: loaders.loadKnowledge } as never);
  repo.getSignedUrl.mockImplementation((async (path: string) => `https://files.test/${path}`) as never);
  repo.listProcessingJobs.mockResolvedValue([] as never);
});

describe('<Viewer /> when the user moves to another document', () => {
  it('a slow document the user already left does not load its chat, highlights, knowledge or file', async () => {
    const slowA = deferred<ReturnType<typeof meta>>();
    repo.getDocument.mockImplementation(((id: string) => (id === 'A' ? slowA.promise : Promise.resolve(meta(id)))) as never);

    const router = mountAt('/viewer/A');
    await act(async () => { await router.navigate('/dashboard'); });
    await act(async () => { await router.navigate('/viewer/B'); });
    await waitFor(() => expect(screen.getByTestId('pdf').getAttribute('data-url')).toBe('https://files.test/ws-1/B.pdf'));
    expect(loaders.loadSession).toHaveBeenCalledTimes(1);

    await act(async () => { slowA.resolve(meta('A')); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    expect(repo.getSignedUrl).toHaveBeenCalledTimes(1);
    expect(repo.getSignedUrl).toHaveBeenCalledWith('ws-1/B.pdf', 3600);
    for (const loader of Object.values(loaders)) {
      expect(loader).toHaveBeenCalledTimes(1);
    }
    expect(loaders.loadSession).toHaveBeenCalledWith('B', 'ws-1');
    expect(screen.getByTestId('pdf').getAttribute('data-url')).toBe('https://files.test/ws-1/B.pdf');
  });

  it('leaving while the file URL is being signed stops that document before it loads anything', async () => {
    const slowUrlA = deferred<string>();
    repo.getDocument.mockImplementation(((id: string) => Promise.resolve(meta(id))) as never);
    repo.getSignedUrl.mockImplementation(((path: string) => (path.endsWith('A.pdf') ? slowUrlA.promise : Promise.resolve(`https://files.test/${path}`))) as never);

    const router = mountAt('/viewer/A');
    await waitFor(() => expect(repo.getSignedUrl).toHaveBeenCalledWith('ws-1/A.pdf', 3600));
    await act(async () => { await router.navigate('/viewer/B'); });
    await waitFor(() => expect(screen.getByTestId('pdf').getAttribute('data-url')).toBe('https://files.test/ws-1/B.pdf'));

    await act(async () => { slowUrlA.resolve('https://files.test/ws-1/A.pdf'); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    expect(loaders.loadSession).toHaveBeenCalledTimes(1);
    expect(loaders.loadSession).toHaveBeenCalledWith('B', 'ws-1');
    expect(screen.getByTestId('pdf').getAttribute('data-url')).toBe('https://files.test/ws-1/B.pdf');
  });

  it('a failure of the document the user already left shows no error over the one on screen', async () => {
    const failingA = deferred<ReturnType<typeof meta>>();
    repo.getDocument.mockImplementation(((id: string) => (id === 'A' ? failingA.promise : Promise.resolve(meta(id)))) as never);

    const router = mountAt('/viewer/A');
    await act(async () => { await router.navigate('/viewer/B'); });
    await waitFor(() => expect(screen.getByTestId('pdf')).toBeTruthy());

    await act(async () => { failingA.reject(new Error('A could not be loaded')); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByTestId('pdf').getAttribute('data-url')).toBe('https://files.test/ws-1/B.pdf');
    expect(screen.queryByText(/A could not be loaded/)).toBeNull();
  });

  it('the document that is on screen still loads everything once', async () => {
    repo.getDocument.mockImplementation(((id: string) => Promise.resolve(meta(id))) as never);
    mountAt('/viewer/A');
    await waitFor(() => expect(screen.getByTestId('pdf')).toBeTruthy());
    expect(loaders.loadSession).toHaveBeenCalledWith('A', 'ws-1');
    expect(loaders.loadHighlights).toHaveBeenCalledWith('A');
    expect(loaders.loadCategories).toHaveBeenCalledWith('ws-1');
    expect(loaders.loadKnowledge).toHaveBeenCalledWith('A');
  });
});
