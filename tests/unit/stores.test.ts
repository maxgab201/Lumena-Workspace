import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../../src/stores/workspaceStore';
import { useUiStore } from '../../src/stores/uiStore';
import { useUserStore } from '../../src/stores/userStore';

// Mock repositories
vi.mock('../../src/repositories/workspace.repository', () => ({
  WorkspaceRepository: {
    listWorkspaces: vi.fn().mockResolvedValue([]),
    createWorkspace: vi.fn().mockResolvedValue({ id: 'ws-1', name: 'Test', created_at: new Date().toISOString() }),
    updateWorkspace: vi.fn().mockResolvedValue({ id: 'ws-1', name: 'Updated', created_at: new Date().toISOString() }),
    deleteWorkspace: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../src/repositories/document.repository', () => ({
  DocumentRepository: {
    listDocuments: vi.fn().mockResolvedValue([]),
    uploadFile: vi.fn().mockResolvedValue({}),
    createDocumentRecord: vi.fn().mockResolvedValue({ id: 'doc-1', name: 'test.pdf', size_bytes: 1024, file_path: 'ws-1/test.pdf', mime_type: 'application/pdf', created_at: new Date().toISOString() }),
    createProcessingJob: vi.fn().mockResolvedValue({ id: 'job-1', workspace_id: 'ws-1', document_id: 'doc-1', status: 'queued', progress: 0 }),
    subscribeToProcessingJobs: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  },
}));

vi.mock('../../src/repositories/auth.repository', () => ({
  AuthRepository: {
    getUser: vi.fn().mockResolvedValue(null),
    signOut: vi.fn().mockResolvedValue({}),
  },
}));

describe('WorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().fetchWorkspaces = vi.fn().mockResolvedValue(undefined);
  });

  it('should have initial state', () => {
    const state = useWorkspaceStore.getState();
    expect(state.workspaces).toEqual([]);
    expect(state.activeWorkspace).toBeNull();
    expect(state.documents).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should set active workspace', () => {
    const mockWorkspace = { id: 'ws-1', name: 'Test Workspace', created_at: new Date().toISOString() };
    useWorkspaceStore.getState().setActiveWorkspace(mockWorkspace);
    expect(useWorkspaceStore.getState().activeWorkspace).toEqual(mockWorkspace);
  });

  it('should clear active workspace', () => {
    useWorkspaceStore.getState().setActiveWorkspace({ id: 'ws-1', name: 'Test', created_at: new Date().toISOString() });
    useWorkspaceStore.getState().setActiveWorkspace(null);
    expect(useWorkspaceStore.getState().activeWorkspace).toBeNull();
    expect(useWorkspaceStore.getState().documents).toEqual([]);
  });
});

describe('UiStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have initial state', () => {
    const state = useUiStore.getState();
    expect(state.theme).toBe('system');
    expect(state.viewMode).toBe('grid');
    expect(state.sortBy).toBe('date');
    expect(state.sortOrder).toBe('desc');
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.mobileSidebarOpen).toBe(false);
    expect(state.commandPaletteOpen).toBe(false);
    expect(state.activeRightPanel).toBeNull();
  });

  it('should toggle sort order', async () => {
    const { toggleSortOrder } = useUiStore.getState();
    await toggleSortOrder();
    expect(useUiStore.getState().sortOrder).toBe('asc');
    await toggleSortOrder();
    expect(useUiStore.getState().sortOrder).toBe('desc');
  });

  it('should set view mode', async () => {
    const { setViewMode } = useUiStore.getState();
    await setViewMode('list');
    expect(useUiStore.getState().viewMode).toBe('list');
  });

  it('should toggle sidebar', () => {
    const { toggleSidebar } = useUiStore.getState();
    toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it('should set active right panel', () => {
    const { setActiveRightPanel } = useUiStore.getState();
    setActiveRightPanel('chat');
    expect(useUiStore.getState().activeRightPanel).toBe('chat');
    setActiveRightPanel('knowledge');
    expect(useUiStore.getState().activeRightPanel).toBe('knowledge');
    setActiveRightPanel('none');
    expect(useUiStore.getState().activeRightPanel).toBe('none');
  });
});

describe('UserStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have initial state', () => {
    const state = useUserStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('should initialize and load user', async () => {
    const { initialize } = useUserStore.getState();
    await initialize();
    // Just verify it runs without error
    expect(useUserStore.getState().loading).toBe(false);
  });

  it('should sign out', async () => {
    const { signOut } = useUserStore.getState();
    await signOut();
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().profile).toBeNull();
    expect(useUserStore.getState().loading).toBe(false);
  });
});