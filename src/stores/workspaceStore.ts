import { create } from 'zustand';
import type { Workspace, Document } from '../types';
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
  fetchDocuments: (workspaceId: string) => Promise<void>;
  uploadDocument: (file: File) => Promise<Document>;
  renameDocument: (id: string, newName: string) => Promise<void>;
  deleteDocument: (id: string, filePath: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  documents: [],
  activeWorkspaceId: null,
  isLoading: false,
  error: null,
  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id });
    get().fetchDocuments(id);
  },
  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await apiService.getWorkspaces();
      const firstId = workspaces.length > 0 ? workspaces[0].id : null;
      set({ 
        workspaces, 
        activeWorkspaceId: firstId,
        isLoading: false 
      });
      if (firstId) {
        get().fetchDocuments(firstId);
      }
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
    get().fetchDocuments(newWorkspace.id);
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
      const newActiveId = state.activeWorkspaceId === id 
          ? (filtered.length > 0 ? filtered[0].id : null) 
          : state.activeWorkspaceId;
      return {
        workspaces: filtered,
        activeWorkspaceId: newActiveId
      };
    });
    
    const { activeWorkspaceId } = get();
    if (activeWorkspaceId) {
      get().fetchDocuments(activeWorkspaceId);
    } else {
      set({ documents: [] });
    }
  },
  fetchDocuments: async (workspaceId: string) => {
    try {
      const documents = await apiService.getDocuments(workspaceId);
      set({ documents });
    } catch (error) {
      console.error('Failed to fetch documents', error);
    }
  },
  uploadDocument: async (file: File) => {
    const { activeWorkspaceId } = get();
    if (!activeWorkspaceId) throw new Error('No active workspace');
    
    const newDoc = await apiService.uploadDocument(file, activeWorkspaceId);
    
    set((state) => ({
      documents: [newDoc, ...state.documents]
    }));
    
    return newDoc;
  },
  renameDocument: async (id: string, newName: string) => {
    const updated = await apiService.renameDocument(id, newName);
    set((state) => ({
      documents: state.documents.map(d => d.id === id ? updated : d)
    }));
  },
  deleteDocument: async (id: string, filePath: string) => {
    await apiService.deleteDocument(id, filePath);
    set((state) => ({
      documents: state.documents.filter(d => d.id !== id)
    }));
  }
}));
