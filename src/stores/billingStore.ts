import { create } from 'zustand';
import { BillingRepository } from '../repositories/billing.repository';
import { useWorkspaceStore } from './workspaceStore';

interface SubscriptionPlan {
  code: string;
  display_name: string;
}

interface Subscription {
  id: string;
  workspace_id: string;
  plan: SubscriptionPlan | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_usd: number;
  stripe_price_id: string | null;
}

interface Balance {
  available: number;
  reserved: number;
  consumed: number;
  expired: number;
  activeBuckets: number;
}

interface CreditAccount {
  available: number;
  reserved: number;
  consumed: number;
  expired: number;
}

interface BillingStore {
  subscription: Subscription | null;
  account: CreditAccount | null;
  transactions: any[];
  packages: CreditPackage[];
  balance: Balance | null;
  loading: boolean;
  error: string | null;
  fetchBillingData: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  checkoutPackage: (packageId: string) => Promise<void>;
}

export const useBillingStore = create<BillingStore>((set, get) => ({
  subscription: null,
  account: null,
  transactions: [],
  packages: [],
  balance: null,
  loading: false,
  error: null,

  fetchBillingData: async () => {
    const workspace = useWorkspaceStore.getState().activeWorkspace;
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
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  fetchBalance: async () => {
    const workspace = useWorkspaceStore.getState().activeWorkspace;
    if (!workspace) return;

    try {
      const balance = await BillingRepository.getBalance(workspace.id);
      set({ balance });
    } catch (err: unknown) {
      console.error('[BillingStore] Failed to fetch balance:', err);
    }
  },

  checkoutPackage: async (packageId: string) => {
    const workspace = useWorkspaceStore.getState().activeWorkspace;
    if (!workspace) return;
    
    set({ loading: true, error: null });
    try {
      const response = await BillingRepository.createCheckoutSession(workspace.id, packageId);
      if (response && response.url) {
        window.location.href = response.url;
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },
}));