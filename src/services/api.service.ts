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
  }
};
