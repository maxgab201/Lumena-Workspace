import { supabase } from '../lib/supabase';

const supabaseRpc = supabase.rpc as any;

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

  async reserveCredits(params: {
    workspaceId: string;
    amount: number;
    idempotencyKey: string;
    jobId?: string;
    ttlSeconds?: number;
  }) {
    const { data, error } = await supabaseRpc('reserve_credits_simple', {
      p_workspace_id: params.workspaceId,
      p_amount: params.amount,
      p_idempotency_key: params.idempotencyKey,
      p_job_id: params.jobId ?? null,
      p_ttl_seconds: params.ttlSeconds ?? 300,
    });

    if (error) throw error;
    return data;
  },

  async settleCredits(params: {
    reservationId: string;
    actualAmount: number;
  }) {
    const { error } = await supabaseRpc('settle_credits_simple', {
      p_reservation_id: params.reservationId,
      p_actual_amount: params.actualAmount,
    });

    if (error) throw error;
  },

  async releaseCredits(reservationId: string) {
    const { error } = await supabaseRpc('release_credits_simple', {
      p_reservation_id: reservationId,
    });

    if (error) throw error;
  },

  async grantCredits(params: {
    workspaceId: string;
    amount: number;
    source: 'subscription' | 'purchase' | 'promotion' | 'manual';
    expiresAt?: string;
    priority?: number;
    idempotencyKey?: string;
  }) {
    const { data, error } = await supabaseRpc('grant_credits_simple', {
      p_workspace_id: params.workspaceId,
      p_amount: params.amount,
      p_source: params.source,
      p_expires_at: params.expiresAt ?? null,
      p_priority: params.priority ?? 100,
      p_idempotency_key: params.idempotencyKey ?? null,
    });

    if (error) throw error;
    return data;
  },

  async expireCredits(workspaceId: string) {
    const { data, error } = await supabaseRpc('expire_credits_simple', {
      p_workspace_id: workspaceId,
    });

    if (error) throw error;
    return data;
  },

  async getBalance(workspaceId: string) {
    const { data, error } = await supabaseRpc('get_balance_simple', {
      p_workspace_id: workspaceId,
    });

    if (error) throw error;
    return data?.[0] ?? {
      available: 0,
      reserved: 0,
      consumed: 0,
      expired: 0,
      activeBuckets: 0,
    };
  },

  async consumeCredits(params: {
    workspaceId: string;
    amount: number;
    entryType: 'consume' | 'grant_plan' | 'grant_purchase' | 'grant_promotion' | 'manual_adjustment';
    reservationId?: string;
    jobId?: string;
    idempotencyKey?: string;
  }) {
    const { data, error } = await supabaseRpc('consume_credits', {
      p_workspace_id: params.workspaceId,
      p_amount: params.amount,
      p_entry_type: params.entryType,
      p_reservation_id: params.reservationId ?? null,
      p_job_id: params.jobId ?? null,
      p_idempotency_key: params.idempotencyKey ?? null,
    });

    if (error) throw error;
    return data;
  },
};