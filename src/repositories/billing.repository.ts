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

  async getCreditPackages() {
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('price_usd', { ascending: true });
      
    if (error) throw error;
    return data;
  },

  async createCheckoutSession(workspaceId: string, packageId: string) {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        workspace_id: workspaceId,
        package_id: packageId,
        success_url: window.location.origin + '/billing',
        cancel_url: window.location.origin + '/billing'
      }
    });

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
