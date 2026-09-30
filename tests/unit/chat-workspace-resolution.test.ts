import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { supabase } from '../../src/lib/supabase';
import { useWorkspaceStore } from '../../src/stores/workspaceStore';
import { useViewerStore } from '../../src/stores/viewerStore';
import { useChatStore } from '../../src/stores/chatStore';
import { AIGateway } from '../../src/lib/providers/AIGateway';

/**
 * The document being read decides which workspace a chat runs in. It is NOT always the
 * workspace selected in the sidebar: a viewer opened from a link, or reloaded, can belong
 * to another one. The backend verifies that the document belongs to the workspace it is
 * given, so the client has to send the document's workspace.
 */

vi.mock('../../src/config/env', () => ({
  env: { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'test-anon-key-123' },
}));

vi.mock('../../src/repositories/chat.repository', () => ({
  ChatRepository: {
    getOrCreateSession: vi.fn(),
    getMessages: vi.fn().mockResolvedValue([]),
    addMessage: vi.fn(async (_session: string, role: string, content: string) => ({ id: `${role}-msg`, role, content })),
    updateMessage: vi.fn().mockResolvedValue(undefined),
    clearSession: vi.fn(),
  },
}));

const workspaceA = { id: 'ws-a', name: 'A', created_at: '2026-01-01T00:00:00.000Z' };

const sseBody = () => new Response('data: {"chunk":"hi"}\n\ndata: {"done":true}\n\n', { status: 200 });

beforeEach(() => {
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
  useChatStore.setState(useChatStore.getInitialState(), true);
  useViewerStore.getState().reset();
  (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AIGateway.generateStream', () => {
  it('sends the workspace carried by the chat context, even when another workspace is active', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseBody());
    vi.stubGlobal('fetch', fetchMock);
    useWorkspaceStore.setState({ workspaces: [workspaceA], activeWorkspace: workspaceA });

    await AIGateway.generateStream('question', { workspaceId: 'ws-b', documentId: 'doc-b' }, 'model', vi.fn());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.workspace_id).toBe('ws-b');
    expect(body.document_id).toBe('doc-b');
  });

  it('falls back to the active workspace when the context carries none', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseBody());
    vi.stubGlobal('fetch', fetchMock);
    useWorkspaceStore.setState({ workspaces: [workspaceA], activeWorkspace: workspaceA });

    await AIGateway.generateStream('question', {}, 'model', vi.fn());

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).workspace_id).toBe('ws-a');
  });
});

describe('chat context for a document of a non-active workspace', () => {
  it('carries the workspace of the document\'s chat session, not the active one', async () => {
    const generateStream = vi.spyOn(AIGateway, 'generateStream').mockResolvedValue({ text: 'ok' });
    // RAG retrieval is best-effort: let it fail quietly.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    useWorkspaceStore.setState({ workspaces: [workspaceA], activeWorkspace: workspaceA });
    useViewerStore.setState({ documentId: 'doc-b', currentPage: 1 });
    useChatStore.setState({
      // Sessions are keyed by DOCUMENT id; the session itself remembers the document's workspace.
      sessions: { 'doc-b': { id: 'session-b', document_id: 'doc-b', workspace_id: 'ws-b' } as never },
      messages: { 'session-b': [] },
      activeSessionId: 'session-b',
    });

    await useChatStore.getState().sendMessage('What is this about?');

    expect(generateStream).toHaveBeenCalledTimes(1);
    const context = generateStream.mock.calls[0][1] as { workspaceId?: string; documentId?: string };
    expect(context.documentId).toBe('doc-b');
    expect(context.workspaceId).toBe('ws-b');
  });

  it('uses the active workspace when the document has no session yet', async () => {
    const generateStream = vi.spyOn(AIGateway, 'generateStream').mockResolvedValue({ text: 'ok' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    useWorkspaceStore.setState({ workspaces: [workspaceA], activeWorkspace: workspaceA });
    useViewerStore.setState({ documentId: 'doc-a', currentPage: 1 });
    useChatStore.setState({ messages: { 'session-a': [] }, activeSessionId: 'session-a' });

    await useChatStore.getState().sendMessage('What is this about?');

    const context = generateStream.mock.calls[0][1] as { workspaceId?: string };
    expect(context.workspaceId).toBe('ws-a');
  });
});
