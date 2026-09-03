import { create } from 'zustand';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { DocumentRepository } from '../repositories/document.repository';
import { toast } from 'sonner';
import type { ProcessingJob } from '../types/processing';
import {
  applyProcessingJob,
  isDocumentActive,
  type WorkspaceDocument,
} from '../types/documents';

interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

interface UploadDocumentOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

interface Subscription {
  unsubscribe: () => Promise<unknown> | unknown;
}

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  documents: WorkspaceDocument[];
  loading: boolean;
  uploadProgress: number;
  error: string | null;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  fetchDocuments: (workspaceId: string) => Promise<void>;
  reconcileDocumentStatuses: (workspaceId: string) => Promise<void>;
  uploadDocument: (file: File, options?: UploadDocumentOptions) => Promise<WorkspaceDocument>;
  retryDocument: (documentId: string) => Promise<void>;
  renameDocument: (id: string, name: string) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  setupSubscriptions: (workspaceId: string) => void;
  cleanupSubscriptions: () => void;
  startStatusPolling: (workspaceId: string) => void;
  stopStatusPolling: () => void;
  _subscriptions: Subscription[];
  _pollTimer: ReturnType<typeof setInterval> | null;
  // Bulk actions
  deleteDocumentsBulk: (documentIds: string[]) => Promise<void>;
  moveDocumentsBulk: (documentIds: string[], targetWorkspaceId: string) => Promise<void>;
  copyDocumentsBulk: (documentIds: string[], targetWorkspaceId: string) => Promise<void>;
}

function mergeDocumentsWithJobs(
  documents: WorkspaceDocument[],
  jobs: ProcessingJob[],
): WorkspaceDocument[] {
  const latestJobByDocument = new Map<string, ProcessingJob>();
  for (const job of jobs) {
    if (!latestJobByDocument.has(job.document_id)) {
      latestJobByDocument.set(job.document_id, job);
    }
  }

  return documents.map(document => applyProcessingJob(document, latestJobByDocument.get(document.id)));
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  documents: [],
  loading: false,
  uploadProgress: 0,
  error: null,
  _subscriptions: [],
  _pollTimer: null,

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
      const [documents, jobs] = await Promise.all([
        DocumentRepository.listDocuments(workspaceId),
        DocumentRepository.listProcessingJobs(workspaceId),
      ]);
      if (get().activeWorkspace?.id !== workspaceId) return;

      const merged = mergeDocumentsWithJobs(documents as WorkspaceDocument[], jobs);
      set({ documents: merged, loading: false });
      if (merged.some(isDocumentActive)) get().startStatusPolling(workspaceId);
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load documents',
        loading: false,
      });
    }
  },

  reconcileDocumentStatuses: async (workspaceId) => {
    try {
      const [documents, jobs] = await Promise.all([
        DocumentRepository.listDocuments(workspaceId),
        DocumentRepository.listProcessingJobs(workspaceId),
      ]);
      if (get().activeWorkspace?.id !== workspaceId) return;

      const merged = mergeDocumentsWithJobs(documents as WorkspaceDocument[], jobs);
      set({ documents: merged });
      if (!merged.some(isDocumentActive)) get().stopStatusPolling();
    } catch {
      // Realtime remains active; the next poll retries transient failures.
    }
  },

  uploadDocument: async (file, options = {}) => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) throw new Error('No active workspace');
    set({ loading: true, error: null, uploadProgress: 0 });

    let uploadedPath: string | null = null;
    let newDocument: WorkspaceDocument | null = null;
    try {
      const fileHash = await DocumentRepository.hashFile(file);
      const duplicate = await DocumentRepository.findDocumentByHash(activeWorkspace.id, fileHash);
      if (duplicate) {
        throw new Error(`“${file.name}” is already in this workspace.`);
      }

      const filePath = `${activeWorkspace.id}/${fileHash}.pdf`;
      await DocumentRepository.uploadFile(filePath, file, {
        signal: options.signal,
        onProgress: (progress) => {
          options.onProgress?.(progress);
          set({ uploadProgress: progress });
        },
      });
      uploadedPath = filePath;

      newDocument = await DocumentRepository.createDocumentRecord({
        workspace_id: activeWorkspace.id,
        name: file.name,
        size_bytes: file.size,
        file_path: filePath,
        file_hash: fileHash,
        mime_type: file.type || 'application/pdf',
      }) as WorkspaceDocument;

      // Insert locally before the job is created so fast Realtime events cannot be lost.
      set((state) => ({
        documents: [
          newDocument!,
          ...state.documents.filter(document => document.id !== newDocument!.id),
        ],
      }));
      get().startStatusPolling(activeWorkspace.id);

      const job = await DocumentRepository.createProcessingJob(
        activeWorkspace.id,
        newDocument.id,
      ) as ProcessingJob;
      const documentWithJob = applyProcessingJob(newDocument, job);

      set((state) => ({
        documents: state.documents.map(document =>
          document.id === newDocument!.id ? documentWithJob : document
        ),
        loading: false,
        uploadProgress: 0,
      }));

      return documentWithJob;
    } catch (err: unknown) {
      if (newDocument) {
        try {
          await DocumentRepository.deleteDocument(newDocument.id, newDocument.file_path);
          set((state) => ({
            documents: state.documents.filter(document => document.id !== newDocument!.id),
          }));
        } catch {
          await DocumentRepository.updateDocumentStatus(newDocument.id, 'error').catch(() => undefined);
          set((state) => ({
            documents: state.documents.map(document => document.id === newDocument!.id
              ? {
                  ...document,
                  status: 'error',
                  processing_status: 'failed',
                  processing_error: 'Upload setup failed. Retry processing or delete this document.',
                }
              : document),
          }));
        }
      } else if (uploadedPath) {
        await DocumentRepository.removeFile(uploadedPath).catch(() => undefined);
      }

      const message = err instanceof Error ? err.message : 'Upload failed';
      const isCancelled = err instanceof DOMException && err.name === 'AbortError';
      set({ error: isCancelled ? null : message, loading: false, uploadProgress: 0 });
      throw err;
    }
  },

  retryDocument: async (documentId) => {
    const { activeWorkspace, documents } = get();
    const document = documents.find(item => item.id === documentId);
    if (!activeWorkspace || !document) throw new Error('Document not found');

    set((state) => ({
      documents: state.documents.map(item => item.id === documentId
        ? {
            ...item,
            status: 'processing',
            processing_status: 'retrying',
            processing_error: null,
            progress: 0,
          }
        : item),
    }));

    try {
      await DocumentRepository.cancelActiveProcessingJobs(documentId);
      await DocumentRepository.updateDocumentStatus(documentId, 'processing');
      const job = await DocumentRepository.createProcessingJob(
        activeWorkspace.id,
        documentId,
      ) as ProcessingJob;
      set((state) => ({
        documents: state.documents.map(item =>
          item.id === documentId ? applyProcessingJob(item, job) : item
        ),
      }));
      get().startStatusPolling(activeWorkspace.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Processing could not be restarted';
      await DocumentRepository.updateDocumentStatus(documentId, 'error').catch(() => undefined);
      set((state) => ({
        documents: state.documents.map(item => item.id === documentId
          ? { ...item, status: 'error', processing_status: 'failed', processing_error: message }
          : item),
      }));
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

  cleanupSubscriptions: () => {
    for (const subscription of get()._subscriptions) {
      void subscription.unsubscribe();
    }
    set({ _subscriptions: [] });
    get().stopStatusPolling();
  },

  // Bulk actions
  deleteDocumentsBulk: async (documentIds: string[]) => {
    if (documentIds.length === 0) return;
    set({ loading: true, error: null });
    try {
      await DocumentRepository.deleteDocumentsBulk(documentIds);
      set((state) => ({
        documents: state.documents.filter((d) => !documentIds.includes(d.id)),
        loading: false,
      }));
      toast.success(`${documentIds.length} document(s) deleted`);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      toast.error('Failed to delete documents');
      throw err;
    }
  },

  moveDocumentsBulk: async (documentIds: string[], targetWorkspaceId: string) => {
    if (documentIds.length === 0) return;
    set({ loading: true, error: null });
    try {
      await DocumentRepository.moveDocumentsBulk(documentIds, targetWorkspaceId);
      set((state) => ({
        documents: state.documents.map((d) =>
          documentIds.includes(d.id) ? { ...d, workspace_id: targetWorkspaceId } : d
        ),
        loading: false,
      }));
      toast.success(`${documentIds.length} document(s) moved`);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      toast.error('Failed to move documents');
      throw err;
    }
  },

  copyDocumentsBulk: async (documentIds: string[], targetWorkspaceId: string) => {
    if (documentIds.length === 0) return;
    set({ loading: true, error: null });
    try {
      const copies = await DocumentRepository.copyDocumentsBulk(documentIds, targetWorkspaceId);
      set((state) => ({
        documents: [...state.documents, ...(copies as WorkspaceDocument[])],
        loading: false,
      }));
      toast.success(`${documentIds.length} document(s) copied`);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      toast.error('Failed to copy documents');
      throw err;
    }
  },

  setupSubscriptions: (workspaceId) => {
    const processingSubscription = DocumentRepository.subscribeToProcessingJobs(workspaceId, (job) => {
      if (get().activeWorkspace?.id !== workspaceId) return;
      set((state) => {
        const hasDocument = state.documents.some(document => document.id === job.document_id);
        if (!hasDocument) {
          void get().reconcileDocumentStatuses(workspaceId);
          return state;
        }
        const documents = state.documents.map(document =>
          document.id === job.document_id ? applyProcessingJob(document, job) : document
        );
        return { documents };
      });
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        void get().reconcileDocumentStatuses(workspaceId);
      } else {
        get().startStatusPolling(workspaceId);
      }
    });

    const documentSubscription = DocumentRepository.subscribeToDocuments(
      workspaceId,
      (eventType, updatedDocument) => {
        if (get().activeWorkspace?.id !== workspaceId) return;
        set((state) => {
          if (eventType === 'DELETE') {
            return {
              documents: state.documents.filter(document => document.id !== updatedDocument.id),
            };
          }

          const existing = state.documents.find(document => document.id === updatedDocument.id);
          if (!existing) return { documents: [updatedDocument, ...state.documents] };
          return {
            documents: state.documents.map(document =>
              document.id === updatedDocument.id
                ? { ...document, ...updatedDocument }
                : document
            ),
          };
        });
      },
    );

    set({ _subscriptions: [processingSubscription, documentSubscription] });
  },

  startStatusPolling: (workspaceId) => {
    if (get()._pollTimer) return;
    const pollTimer = setInterval(() => {
      void get().reconcileDocumentStatuses(workspaceId);
    }, 2_000);
    set({ _pollTimer: pollTimer });
    void get().reconcileDocumentStatuses(workspaceId);
  },

  stopStatusPolling: () => {
    const pollTimer = get()._pollTimer;
    if (pollTimer) clearInterval(pollTimer);
    set({ _pollTimer: null });
  },
}));
