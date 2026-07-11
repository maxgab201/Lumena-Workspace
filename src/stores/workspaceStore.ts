import { create } from 'zustand';
import type { Workspace, Document } from '../types';
import { mockWorkspaces, mockDocuments } from '../lib/mocks/data.mock';

interface WorkspaceState {
  workspaces: Workspace[];
  documents: Document[];
  activeWorkspaceId: string | null;
  setActiveWorkspace: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: mockWorkspaces,
  documents: mockDocuments,
  activeWorkspaceId: mockWorkspaces[0]?.id || null,
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
}));
