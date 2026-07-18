import { supabase } from '../lib/supabase';

export const BillingRepository = {
  async getSubscription() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async consumeCredits(amount: number, description: string) {
    const { data, error } = await supabase.rpc('consume_credits', {
      p_amount: amount,
      p_description: description,
      p_user_id: (await supabase.auth.getUser()).data.user?.id || '',
    });
    if (error) throw error;
    return data;
  },
};
