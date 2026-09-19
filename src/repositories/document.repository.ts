import { supabase } from '../lib/supabase';
import { env } from '../config/env';
import type { ProcessingJob } from '../types/processing';
import type { WorkspaceDocument } from '../types/documents';

const BUCKET = 'workspace_documents';

interface UploadFileOptions {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

function encodeStoragePath(filePath: string): string {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

function uploadWithProgress(
  filePath: string,
  file: File | Blob,
  accessToken: string,
  options: UploadFileOptions,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => options.signal?.removeEventListener('abort', abort);

    if (options.signal?.aborted) {
      reject(new DOMException('Upload cancelled', 'AbortError'));
      return;
    }

    xhr.open(
      'POST',
      `${env.supabaseUrl}/storage/v1/object/${BUCKET}/${encodeStoragePath(filePath)}`,
    );
    xhr.setRequestHeader('apikey', env.supabaseAnonKey);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.responseText);
        }
        return;
      }

      let message = `Upload failed (${xhr.status})`;
      try {
        const response = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = response.message || response.error || message;
      } catch {
        // Keep the HTTP status fallback when Storage does not return JSON.
      }
      reject(new Error(message));
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error('The upload could not reach storage. Check your connection and try again.'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };

    options.signal?.addEventListener('abort', abort, { once: true });

    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);
    xhr.send(body);
  });
}

export const DocumentRepository = {
  /**
   * Upload a file to the workspace_documents storage bucket.
   * Accepts an optional onProgress callback for real upload tracking.
   */
  async uploadFile(
    filePath: string,
    file: File | Blob,
    options: UploadFileOptions = {},
  ) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Your session expired. Sign in and try the upload again.');

    options.onProgress?.(0);
    return uploadWithProgress(filePath, file, accessToken, options);
  },

  async hashFile(file: File | Blob): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  },

  async findDocumentByHash(workspaceId: string, fileHash: string): Promise<WorkspaceDocument | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('file_hash', fileHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as WorkspaceDocument | null;
  },

  /**
   * Create a database record for an uploaded document.
   */
  async createDocumentRecord(document: {
    workspace_id: string;
    name: string;
    size_bytes: number;
    file_path: string;
    file_hash: string;
    mime_type?: string;
  }) {
    const { data, error } = await supabase
      .from('documents')
      .insert(document)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Create a processing job for a document. This triggers the backend webhook.
   */
  async createProcessingJob(workspaceId: string, documentId: string) {
    const { data, error } = await supabase
      .from('processing_jobs')
      .insert({
        workspace_id: workspaceId,
        document_id: documentId,
        status: 'queued',
        progress: 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listProcessingJobs(workspaceId: string): Promise<ProcessingJob[]> {
    const { data, error } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ProcessingJob[];
  },

  async cancelActiveProcessingJobs(documentId: string) {
    const { error } = await supabase
      .from('processing_jobs')
      .update({ status: 'cancelled' })
      .eq('document_id', documentId)
      .in('status', ['queued', 'inspecting', 'extracting', 'ocr', 'layout', 'processing', 'retrying', 'paused']);
    if (error) throw error;
  },

  /**
   * Watchdog sweep: reap processing jobs whose heartbeat is stale (the Edge
   * Function died mid-flight). Returns how many jobs were reaped.
   */
  async reapStaleProcessingJobs(): Promise<number> {
    // RPC added by 20250912000001_incremental_pipeline.sql (not in generated types yet)
    const { data, error } = await (supabase.rpc as unknown as (
      fn: string, args?: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>)(
      'reap_stale_processing_jobs', { stale_minutes: 10 }
    );
    if (error) throw error;
    return Number(data ?? 0);
  },

  /**
   * Subscribe to real-time updates for processing jobs in a workspace.
   */
  subscribeToProcessingJobs(workspaceId: string, onUpdate: (job: ProcessingJob) => void) {
    return supabase
      .channel(`processing_jobs_${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'processing_jobs', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => onUpdate(payload.new as ProcessingJob)
      )
      .subscribe();
  },

  subscribeToDocuments(
    workspaceId: string,
    onUpdate: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', document: WorkspaceDocument) => void,
  ) {
    return supabase
      .channel(`documents_${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const document = (payload.eventType === 'DELETE' ? payload.old : payload.new) as WorkspaceDocument;
          onUpdate(payload.eventType, document);
        },
      )
      .subscribe();
  },

  /**
   * Fetch a single document by ID.
   */
  async getDocument(id: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * List all documents in a workspace, newest first.
   */
  async listDocuments(workspaceId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Rename a document. Kept in the repository layer — no direct Supabase
   * calls from stores allowed.
   */
  async renameDocument(id: string, name: string) {
    const { data, error } = await supabase
      .from('documents')
      .update({ name })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Update a document's processing status and optional page count.
   */
  async updateDocumentStatus(
    id: string,
    status: 'uploading' | 'processing' | 'ready' | 'error',
    pageCount?: number,
  ) {
    const { data, error } = await supabase
      .from('documents')
      .update({ status, ...(pageCount !== undefined ? { page_count: pageCount } : {}) })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Delete a document record AND its corresponding storage object.
   * Always uses the workspace_documents bucket — callers should not need
   * to know which bucket is being used.
   */
  async deleteDocument(id: string, filePath: string) {
    // Delete from storage first. If the file is already gone, that's fine.
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([filePath]);
    // A 404 on storage is not a fatal error (file may have already been removed).
    if (storageError && storageError.message !== 'The resource was not found') {
      throw storageError;
    }

    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);
    if (dbError) throw dbError;
  },

  async removeFile(filePath: string) {
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error && error.message !== 'The resource was not found') throw error;
  },

  /**
   * Update a document's thumbnail path.
   */
  async updateDocumentThumbnail(
    id: string,
    thumbnailPath: string,
  ) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        thumbnail_path: thumbnailPath,
        thumbnail_generated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Generate a signed URL for temporary access to a private file.
   * Default TTL: 1 hour.
   */
  async getSignedUrl(
    filePath: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  },

  /**
   * Generate signed URLs for multiple files at once. Returns a map of
   * filePath -> signedUrl for entries that succeeded; failures are omitted.
   */
  async getSignedUrls(
    filePaths: string[],
    expiresInSeconds: number = 3600,
  ): Promise<Record<string, string>> {
    if (filePaths.length === 0) return {};
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(filePaths, expiresInSeconds);
    if (error) throw error;
    const map: Record<string, string> = {};
    (data ?? []).forEach(item => {
      if (item.path && item.signedUrl && item.error == null) {
        map[item.path] = item.signedUrl;
      }
    });
    return map;
  },
/**
   * Delete multiple documents in bulk.
   */
  async deleteDocumentsBulk(ids: string[]) {
    if (ids.length === 0) return;

    // Get file paths for storage deletion
    const { data: docs, error: fetchError } = await supabase
      .from('documents')
      .select('id, file_path')
      .in('id', ids);
    if (fetchError) throw fetchError;

    // Delete from storage
    const filePaths = docs.map(doc => doc.file_path);
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove(filePaths);
    if (storageError && storageError.message !== 'The resource was not found') {
      throw storageError;
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .in('id', ids);
    if (dbError) throw dbError;
  },

  /**
   * Move documents to another workspace without leaving Storage and DB out of sync.
   * Storage is moved first; the DB half is committed atomically by the hardened RPC.
   * If the DB step fails, Storage is moved back best-effort.
   */
  async moveDocumentsBulk(ids: string[], targetWorkspaceId: string): Promise<string[]> {
    if (ids.length === 0) return [];

    const { data: docs, error: fetchError } = await supabase
      .from('documents')
      .select('id, workspace_id, file_path, file_hash')
      .in('id', ids);
    if (fetchError) throw fetchError;

    const movedIds: string[] = [];
    const rpcClient = supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };

    for (const doc of docs ?? []) {
      if (!doc.file_hash) throw new Error('Document is missing its file hash.');

      const duplicate = await this.findDocumentByHash(targetWorkspaceId, doc.file_hash);
      if (duplicate && duplicate.id !== doc.id) {
        throw new Error(`“${duplicate.name}” already exists in the target workspace.`);
      }

      const fileName = doc.file_path.split('/').pop() || `${doc.file_hash}.pdf`;
      const targetPath = `${targetWorkspaceId}/${fileName}`;

      const { error: moveError } = await supabase.storage
        .from(BUCKET)
        .move(doc.file_path, targetPath);
      if (moveError) throw moveError;

      try {
        const { error: rpcError } = await rpcClient.rpc('move_document_workspace', {
          p_document_id: doc.id,
          p_target_workspace_id: targetWorkspaceId,
          p_new_file_path: targetPath,
        });
        if (rpcError) throw new Error(rpcError.message);
        movedIds.push(doc.id);
      } catch (error) {
        const rollback = await supabase.storage
          .from(BUCKET)
          .move(targetPath, doc.file_path);
        if (rollback.error) {
          console.error('[DocumentRepository] Failed to roll back Storage move:', rollback.error);
        }
        throw error;
      }
    }

    return movedIds;
  },

  /**
   * Copy the physical PDF to the target workspace, create a new document row,
   * and re-run processing there. Derived AI/annotation data is intentionally
   * regenerated instead of pointing the target workspace at source-owned data.
   */
  async copyDocumentsBulk(ids: string[], targetWorkspaceId: string) {
    if (ids.length === 0) return [];

    const { data: docs, error: fetchError } = await supabase
      .from('documents')
      .select('id, name, size_bytes, file_path, file_hash, mime_type')
      .in('id', ids);
    if (fetchError) throw fetchError;

    const copies: WorkspaceDocument[] = [];

    for (const doc of docs ?? []) {
      if (!doc.file_hash) throw new Error('Document is missing its file hash.');

      const duplicate = await this.findDocumentByHash(targetWorkspaceId, doc.file_hash);
      if (duplicate) {
        throw new Error(`“${doc.name}” already exists in the target workspace.`);
      }

      const fileName = doc.file_path.split('/').pop() || `${doc.file_hash}.pdf`;
      const targetPath = `${targetWorkspaceId}/${fileName}`;

      const { error: copyError } = await supabase.storage
        .from(BUCKET)
        .copy(doc.file_path, targetPath);
      if (copyError) throw copyError;

      let created: WorkspaceDocument | null = null;
      try {
        created = await this.createDocumentRecord({
          workspace_id: targetWorkspaceId,
          name: doc.name,
          size_bytes: doc.size_bytes,
          file_path: targetPath,
          file_hash: doc.file_hash,
          mime_type: doc.mime_type ?? 'application/pdf',
        }) as WorkspaceDocument;

        await this.createProcessingJob(targetWorkspaceId, created.id);
        copies.push(created);
      } catch (error) {
        if (created) {
          await supabase.from('documents').delete().eq('id', created.id);
        }
        await supabase.storage.from(BUCKET).remove([targetPath]);
        throw error;
      }
    }

    return copies;
  },
};
