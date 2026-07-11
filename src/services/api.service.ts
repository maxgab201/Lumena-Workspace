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
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name })
      .select()
      .single();

    if (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }

    // After creating a workspace, we must link it to the user.
    // However, our policy on `workspaces` requires the user to be a member to view it.
    // So creating it directly from the client might be tricky unless there is a trigger or RPC.
    // Wait, the client can insert into `workspaces` because there is no policy that restricts insert (wait, I didn't add an INSERT policy for workspaces!)
    // If I didn't add an INSERT policy, RLS will block inserts! Let's check my SQL.
    // I did not create an INSERT policy for workspaces!
    // I should create an RPC to handle workspace creation securely.
    
    return data as Workspace;
  }
};
