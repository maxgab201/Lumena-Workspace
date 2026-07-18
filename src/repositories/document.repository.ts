import { supabase } from '../lib/supabase';

export const DocumentRepository = {
  async uploadFile(bucketName: string, filePath: string, file: File | Blob) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });
    if (error) throw error;
    return data;
  },

  async createDocumentRecord(document: {
    workspace_id: string;
    name: string;
    size_bytes: number;
    file_path: string;
  }) {
    const { data, error } = await supabase
      .from('documents')
      .insert(document)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listDocuments(workspaceId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async deleteDocument(id: string, bucketName: string, filePath: string) {
    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);
    if (storageError) throw storageError;

    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);
    if (dbError) throw dbError;
  },

  async getSignedUrl(bucketName: string, filePath: string, expiresInSeconds: number = 3600) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  },
};
