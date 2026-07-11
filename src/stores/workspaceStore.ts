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
  createWorkspace: (name: string) => Promise<Workspace>;
  renameWorkspace: (id: string, name: string) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
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
  createWorkspace: async (name: string) => {
    const newWorkspace = await apiService.createWorkspace(name);
    set((state) => ({
      workspaces: [newWorkspace, ...state.workspaces],
      activeWorkspaceId: newWorkspace.id
    }));
    return newWorkspace;
  },
  renameWorkspace: async (id: string, name: string) => {
    const updated = await apiService.renameWorkspace(id, name);
    set((state) => ({
      workspaces: state.workspaces.map(w => w.id === id ? updated : w)
    }));
    return updated;
  },
  deleteWorkspace: async (id: string) => {
    await apiService.deleteWorkspace(id);
    set((state) => {
      const filtered = state.workspaces.filter(w => w.id !== id);
      return {
        workspaces: filtered,
        activeWorkspaceId: state.activeWorkspaceId === id 
          ? (filtered.length > 0 ? filtered[0].id : null) 
          : state.activeWorkspaceId
      };
    });
  }
}));
