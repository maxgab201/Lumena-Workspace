import { supabase } from '../lib/supabase';

const BUCKET = 'workspace_documents';

export const DocumentRepository = {
  /**
   * Upload a file to the workspace_documents storage bucket.
   * Accepts an optional onProgress callback for real upload tracking.
   */
  async uploadFile(
    filePath: string,
    file: File | Blob,
    onProgress?: (progress: number) => void,
  ) {
    // Supabase JS v2 does not expose upload progress natively. We fall back
    // to the Supabase SDK and report 100% on completion.
    if (onProgress) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      onProgress(100);
      return data;
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return data;
  },

  /**
   * Create a database record for an uploaded document.
   */
  async createDocumentRecord(document: {
    workspace_id: string;
    name: string;
    size_bytes: number;
    file_path: string;
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

  /**
   * Subscribe to real-time updates for processing jobs in a workspace.
   */
  subscribeToProcessingJobs(workspaceId: string, onUpdate: (job: any) => void) {
    return supabase
      .channel(`processing_jobs_${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'processing_jobs', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => onUpdate(payload.new)
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
   * Move multiple documents to a different workspace.
   */
  async moveDocumentsBulk(ids: string[], targetWorkspaceId: string) {
    if (ids.length === 0) return;

    const { error } = await supabase
      .from('documents')
      .update({ workspace_id: targetWorkspaceId })
      .in('id', ids);
    if (error) throw error;
  },

  /**
   * Copy documents to a different workspace.
   */
  async copyDocumentsBulk(ids: string[], targetWorkspaceId: string) {
    if (ids.length === 0) return;

    // Get documents to copy
    const { data: docs, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .in('id', ids);
    if (fetchError) throw fetchError;

    // Create copies in target workspace
    const copies = docs.map(doc => ({
      workspace_id: targetWorkspaceId,
      name: doc.name,
      size_bytes: doc.size_bytes,
      file_path: doc.file_path,
      mime_type: doc.mime_type,
      page_count: doc.page_count,
      status: doc.status,
    }));

    const { data, error } = await supabase
      .from('documents')
      .insert(copies)
      .select();
    if (error) throw error;
    return data;
  },
};
