import { supabase } from '../lib/supabase';
import type { Workspace } from '../types';

export const apiService = {
  async getWorkspaces(): Promise<Workspace[]> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workspaces:', error);
      throw error;
    }

    return data as Workspace[];
  },

  async createWorkspace(name: string): Promise<Workspace> {
    const { data, error } = await supabase.rpc('create_workspace', {
      workspace_name: name
    });

    if (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }

    // RPC returns the UUID of the new workspace. We need to fetch it.
    const { data: newWorkspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', data)
      .single();

    if (fetchError) throw fetchError;
    return newWorkspace as Workspace;
  },

  async renameWorkspace(id: string, name: string): Promise<Workspace> {
    const { data, error } = await supabase
      .from('workspaces')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error renaming workspace:', error);
      throw error;
    }

    return data as Workspace;
  },

  async deleteWorkspace(id: string): Promise<void> {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting workspace:', error);
      throw error;
    }
  },

  async getDocuments(workspaceId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }

    return data;
  },

  async uploadDocument(file: File, workspaceId: string) {
    const fileExt = file.name.split('.').pop();
    const documentId = crypto.randomUUID();
    const filePath = `${workspaceId}/${documentId}.${fileExt}`;

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('workspace_documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    // Create database record
    const { data, error: dbError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        workspace_id: workspaceId,
        name: file.name,
        file_path: filePath,
        size_bytes: file.size,
        status: 'uploading'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving document record:', dbError);
      throw dbError;
    }

    // In a real app we might trigger a serverless function here to process the PDF
    // For now we will just mock the status change to 'ready' after a delay
    setTimeout(async () => {
      await supabase
        .from('documents')
        .update({ status: 'ready' })
        .eq('id', documentId);
    }, 3000);

    return data;
  },

  async renameDocument(id: string, newName: string) {
    const { data, error } = await supabase
      .from('documents')
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error renaming document:', error);
      throw error;
    }

    return data;
  },

  async deleteDocument(id: string, filePath: string) {
    // 1. Delete from Storage
    const { error: storageError } = await supabase.storage
      .from('workspace_documents')
      .remove([filePath]);

    if (storageError) {
      console.error('Error deleting document from storage:', storageError);
      throw storageError;
    }

    // 2. Delete from Database
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('Error deleting document record:', dbError);
      throw dbError;
    }
  },

  async getDocument(id: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      throw error;
    }

    return data;
  },

  async getDocumentSignedUrl(filePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('workspace_documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error);
      throw error;
    }

    return data.signedUrl;
  },
};

