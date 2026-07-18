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

interface BillingStore {
  subscription: Subscription | null;
  account: CreditAccount | null;
  transactions: LedgerEntry[];
  loading: boolean;
  error: string | null;
  fetchBillingData: () => Promise<void>;
  upgradeToPro: () => Promise<void>;
}

export const useBillingStore = create<BillingStore>((set) => ({
  subscription: null,
  account: null,
  transactions: [],
  loading: false,
  error: null,

  fetchBillingData: async () => {
    const workspace = useWorkspaceStore.getState().activeWorkspace;
    if (!workspace) {
      set({ subscription: null, account: null, transactions: [], loading: false, error: 'No workspace selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const [sub, account, txs] = await Promise.all([
        BillingRepository.getSubscription(workspace.id),
        BillingRepository.getCreditAccount(workspace.id),
        BillingRepository.getLedgerEntries(workspace.id),
      ]);

      set({
        subscription: sub,
        account: account,
        transactions: txs || [],
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  upgradeToPro: async () => {
    set({ loading: true, error: null });
    try {
      // Placeholder logic for Stripe checkout transition
      // In reality, this would call a backend function to generate a Stripe Checkout URL
      // and redirect the user.
      alert('Upgrading to Pro will redirect to Stripe Checkout in the final implementation.');
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
}));
