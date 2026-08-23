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

interface BillingStore {
  subscription: Subscription | null;
  account: CreditAccount | null;
  transactions: LedgerEntry[];
  packages: CreditPackage[];
  loading: boolean;
  error: string | null;
  fetchBillingData: () => Promise<void>;
  upgradeToPro: () => Promise<void>;
  checkoutPackage: (packageId: string) => Promise<void>;
}

export const useBillingStore = create<BillingStore>((set) => ({
  subscription: null,
  account: null,
  transactions: [],
  packages: [],
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
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  upgradeToPro: async () => {
    const workspace = useWorkspaceStore.getState().activeWorkspace;
    if (!workspace) return;
    
    set({ loading: true, error: null });
    try {
      // In a real scenario with subscription plans mapped to packages, we could pass the correct packageId
      // For now, this is a placeholder or relies on the backend to know it's a subscription upgrade
      alert('Upgrading to Pro will redirect to Stripe Checkout in the final implementation.');
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
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
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
}));
