import { create } from 'zustand';
import { BillingRepository } from '../repositories/billing.repository';
import { useWorkspaceStore } from './workspaceStore';

interface Subscription {
  id: string;
  workspace_id: string;
  plan: any;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface LedgerEntry {
  id: string;
  created_at: string;
  entry_type: string;
  amount: number;
  direction: number;
}

interface CreditAccount {
  available: number;
  reserved: number;
  consumed: number;
  expired: number;
}

interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_usd: number;
  stripe_price_id: string | null;
}

type PaymentsConfigured = 'unknown' | 'yes' | 'no';

interface BillingStore {
  subscription: Subscription | null;
  account: CreditAccount | null;
  transactions: LedgerEntry[];
  packages: CreditPackage[];
  paymentsConfigured: PaymentsConfigured;
  loading: boolean;
  error: string | null;
  fetchBillingData: () => Promise<void>;
  checkoutPackage: (packageId: string) => Promise<void>;
}

export const useBillingStore = create<BillingStore>((set) => ({
  subscription: null,
  account: null,
  transactions: [],
  packages: [],
  paymentsConfigured: 'unknown',
  loading: false,
  error: null,

  fetchBillingData: async () => {
    let workspace = useWorkspaceStore.getState().activeWorkspace;
    if (!workspace) {
      await useWorkspaceStore.getState().fetchWorkspaces();
      workspace = useWorkspaceStore.getState().activeWorkspace;
    }
    if (!workspace) {
      set({ subscription: null, account: null, transactions: [], packages: [], loading: false, error: 'No workspace selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const [sub, account, txs, pkgs] = await Promise.all([
        BillingRepository.getSubscription(workspace.id),
        BillingRepository.getCreditAccount(workspace.id),
        BillingRepository.getLedgerEntries(workspace.id),
        BillingRepository.getCreditPackages(),
      ]);

      set({
        subscription: sub,
        account: account,
        transactions: txs || [],
        packages: pkgs || [],
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  /**
   * Start a real Stripe Checkout session for a one-time credit package.
   * If Stripe is not configured server-side the function answers 503 with
   * code 'stripe_not_configured' — surfaced to the UI as an honest notice.
   */
  checkoutPackage: async (packageId: string) => {
    const workspace = useWorkspaceStore.getState().activeWorkspace;
    if (!workspace) return;

    set({ loading: true, error: null });
    try {
      const response = await BillingRepository.createCheckoutSession(workspace.id, packageId);
      if (response?.url) {
        window.location.href = response.url;
        return;
      }
      set({ loading: false });
    } catch (err: any) {
      // FunctionsHttpError carries the Edge Function response body in `context`
      const body = err?.context;
      const code = body?.code ?? (typeof body?.json === 'object' ? body.json?.code : undefined);
      if (code === 'stripe_not_configured') {
        set({ paymentsConfigured: 'no', loading: false });
        return;
      }
      if (code === 'price_not_provisioned') {
        set({ loading: false });
        throw new Error('PRICE_NOT_PROVISIONED');
      }
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
