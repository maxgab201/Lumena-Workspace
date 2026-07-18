import { supabase } from '../lib/supabase';

export const WorkspaceRepository = {
  async createWorkspace(name: string) {
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getWorkspaceById(id: string) {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async listWorkspaces() {
    const { data, error } = await supabase
      .from('workspaces')
      .select(`
        *,
        workspace_members!inner(user_id)
      `);
    if (error) throw error;
    return data;
  },

  async updateWorkspace(id: string, name: string) {
    const { data, error } = await supabase
      .from('workspaces')
      .update({ name })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteWorkspace(id: string) {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getMembers(workspaceId: string) {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (error) throw error;
    return data;
  },

  async addMember(workspaceId: string, userId: string, role: 'owner' | 'member' | 'viewer' = 'member') {
    const { data, error } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: workspaceId, user_id: userId, role })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeMember(workspaceId: string, userId: string) {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    if (error) throw error;
  },
};
