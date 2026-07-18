import { supabase } from '../lib/supabase';

export const BillingRepository = {
  async getSubscription(workspaceId: string) {
    if (!workspaceId) return null;
    
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:plans (*)
      `)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
      
    if (error) throw error;
    return data;
  },

  async getCreditAccount(workspaceId: string) {
    if (!workspaceId) return null;

    const { data, error } = await supabase
      .from('credit_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
      
    if (error) throw error;
    return data;
  },

  async getLedgerEntries(workspaceId: string) {
    if (!workspaceId) return [];

    const { data, error } = await supabase
      .from('credit_ledger')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data;
  },

  // NOTE: In the new architecture, clients cannot directly consume credits via RPC.
  // Credits are reserved and consumed by the backend Edge Function (e.g. process-document)
  // based on actual usage. This function is deprecated for clients.
  async consumeCredits(_amount: number, _description: string) {
    throw new Error('Direct credit consumption is not allowed in production architecture. Credits are consumed automatically via backend services.');
  },
};
