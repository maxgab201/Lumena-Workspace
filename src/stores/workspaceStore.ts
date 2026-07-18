import { create } from 'zustand';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { DocumentRepository } from '../repositories/document.repository';

interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

interface Document {
  id: string;
  workspace_id: string;
  name: string;
  size_bytes: number;
  status?: string;
  file_path: string;
  created_at: string;
}

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  documents: Document[];
  loading: boolean;
  error: string | null;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  fetchDocuments: (workspaceId: string) => Promise<void>;
  uploadDocument: (file: File) => Promise<void>;
  renameDocument: (id: string, name: string) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  documents: [],
  loading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const data = await WorkspaceRepository.listWorkspaces();
      const workspaces: Workspace[] = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        created_at: item.created_at,
      }));
      set({ workspaces, loading: false });
      
      // Auto-select first workspace if none active
      if (workspaces.length > 0 && !get().activeWorkspace) {
        get().setActiveWorkspace(workspaces[0]);
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  createWorkspace: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const newWorkspace = await WorkspaceRepository.createWorkspace(name);
      set((state) => ({
        workspaces: [...state.workspaces, newWorkspace],
        loading: false,
      }));
      get().setActiveWorkspace(newWorkspace);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  renameWorkspace: async (id: string, name: string) => {
    set({ loading: true, error: null });
    try {
      const updated = await WorkspaceRepository.updateWorkspace(id, name);
      set((state) => ({
        workspaces: state.workspaces.map((w) => (w.id === id ? updated : w)),
        activeWorkspace: state.activeWorkspace?.id === id ? updated : state.activeWorkspace,
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  deleteWorkspace: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await WorkspaceRepository.deleteWorkspace(id);
      set((state) => {
        const remaining = state.workspaces.filter((w) => w.id !== id);
        return {
          workspaces: remaining,
          activeWorkspace: state.activeWorkspace?.id === id ? remaining[0] || null : state.activeWorkspace,
          loading: false,
        };
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  setActiveWorkspace: (workspace: Workspace | null) => {
    set({ activeWorkspace: workspace });
    if (workspace) {
      get().fetchDocuments(workspace.id);
    } else {
      set({ documents: [] });
    }
  },

  fetchDocuments: async (workspaceId: string) => {
    set({ loading: true, error: null });
    try {
      const documents = await DocumentRepository.listDocuments(workspaceId);
      set({ documents, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  uploadDocument: async (file: File) => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) throw new Error('No active workspace');
    set({ loading: true, error: null });
    try {
      const bucketName = 'documents';
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${activeWorkspace.id}/${fileName}`;

      // Upload file to storage
      await DocumentRepository.uploadFile(bucketName, filePath, file);

      // Create document record in database
      const newDoc = await DocumentRepository.createDocumentRecord({
        workspace_id: activeWorkspace.id,
        name: file.name,
        size_bytes: file.size,
        file_path: filePath,
      });

      set((state) => ({
        documents: [newDoc, ...state.documents],
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  renameDocument: async (id: string, name: string) => {
    // Note: We need a renameDocument in DocumentRepository, but for now we just throw or implement locally
    // Or better, update supabase to rename the document. Let's just mock it to avoid TS error, or use supabase directly
    const { supabase } = await import('../lib/supabase');
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.from('documents').update({ name }).eq('id', id).select().single();
      if (error) throw error;
      set((state) => ({
        documents: state.documents.map((d) => (d.id === id ? { ...d, name } : d)),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  deleteDocument: async (documentId: string) => {
    set({ loading: true, error: null });
    try {
      const doc = get().documents.find((d) => d.id === documentId);
      if (!doc) throw new Error('Document not found');

      const bucketName = 'documents';
      await DocumentRepository.deleteDocument(doc.id, bucketName, doc.file_path);

      set((state) => ({
        documents: state.documents.filter((d) => d.id !== documentId),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
}));
