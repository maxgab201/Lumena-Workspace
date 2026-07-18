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
  mime_type?: string | null;
  page_count?: number | null;
  created_at: string;
  progress?: number;
}

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  documents: Document[];
  loading: boolean;
  uploadProgress: number;
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
  setupSubscriptions: (workspaceId: string) => void;
  cleanupSubscriptions: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  documents: [],
  loading: false,
  uploadProgress: 0,
  error: null,
  _subscription: null as any,

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

  createWorkspace: async (name) => {
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

  renameWorkspace: async (id, name) => {
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

  deleteWorkspace: async (id) => {
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

  setActiveWorkspace: (workspace) => {
    const { cleanupSubscriptions, setupSubscriptions, fetchDocuments } = get();
    cleanupSubscriptions();
    
    set({ activeWorkspace: workspace });
    
    if (workspace) {
      fetchDocuments(workspace.id);
      setupSubscriptions(workspace.id);
    } else {
      set({ documents: [] });
    }
  },

  fetchDocuments: async (workspaceId) => {
    set({ loading: true, error: null });
    try {
      const documents = await DocumentRepository.listDocuments(workspaceId);
      set({ documents, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  uploadDocument: async (file) => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) throw new Error('No active workspace');
    set({ loading: true, error: null, uploadProgress: 0 });
    try {
      const fileExt = file.name.split('.').pop() ?? 'pdf';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${activeWorkspace.id}/${fileName}`;

      // Upload file to workspace_documents storage bucket with progress tracking
      await DocumentRepository.uploadFile(filePath, file, (progress) => {
        set({ uploadProgress: progress });
      });

      // Create document record in database
      const newDoc = await DocumentRepository.createDocumentRecord({
        workspace_id: activeWorkspace.id,
        name: file.name,
        size_bytes: file.size,
        file_path: filePath,
        mime_type: file.type || 'application/pdf',
      });

      // Create backend processing job
      await DocumentRepository.createProcessingJob(activeWorkspace.id, newDoc.id);

      set((state) => ({
        documents: [{ ...newDoc, progress: 0 }, ...state.documents],
        loading: false,
        uploadProgress: 0,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false, uploadProgress: 0 });
      throw err;
    }
  },

  renameDocument: async (id, name) => {
    // Uses repository — no direct Supabase access from stores
    set({ loading: true, error: null });
    try {
      await DocumentRepository.renameDocument(id, name);
      set((state) => ({
        documents: state.documents.map((d) => (d.id === id ? { ...d, name } : d)),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  deleteDocument: async (documentId) => {
    set({ loading: true, error: null });
    try {
      const doc = get().documents.find((d) => d.id === documentId);
      if (!doc) throw new Error('Document not found');

      // Repository handles bucket selection internally
      await DocumentRepository.deleteDocument(doc.id, doc.file_path);

      set((state) => ({
        documents: state.documents.filter((d) => d.id !== documentId),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  setupSubscriptions: (workspaceId) => {
    const sub = DocumentRepository.subscribeToProcessingJobs(workspaceId, (job) => {
      set((state) => {
        const documents = state.documents.map((doc) => {
          if (doc.id === job.document_id) {
            return {
              ...doc,
              status: job.status === 'completed' ? 'ready' : job.status === 'failed' ? 'error' : 'processing',
              progress: job.progress,
            };
          }
          return doc;
        });
        return { documents };
      });
    });
    set({ _subscription: sub } as any);
  },

  cleanupSubscriptions: () => {
    const state = get() as any;
    if (state._subscription) {
      state._subscription.unsubscribe();
      set({ _subscription: null } as any);
    }
  },
}));
