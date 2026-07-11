import { create } from 'zustand';
import type { Workspace, Document } from '../types';
import { mockDocuments } from '../lib/mocks/data.mock';
import { apiService } from '../services/api.service';

interface WorkspaceState {
  workspaces: Workspace[];
  documents: Document[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  error: Error | null;
  setActiveWorkspace: (id: string) => void;
  fetchWorkspaces: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  documents: mockDocuments, // Documents are still mocked for now
  activeWorkspaceId: null,
  isLoading: false,
  error: null,
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await apiService.getWorkspaces();
      set({ 
        workspaces, 
        activeWorkspaceId: workspaces.length > 0 ? workspaces[0].id : null,
        isLoading: false 
      });
    } catch (error: any) {
      set({ error, isLoading: false });
    }
  },
}));
