import { create } from 'zustand';
import { BillingRepository } from '../repositories/billing.repository';

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  credits_remaining: number;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface Transaction {
  id: string;
  created_at: string;
  description: string | null;
  amount: number;
  type: string;
}

interface BillingStore {
  subscription: Subscription | null;
  transactions: Transaction[];
  creditsRemaining: number;
  creditsTotal: number;
  loading: boolean;
  error: string | null;
  fetchBillingData: () => Promise<void>;
  consumeCredits: (amount: number, description: string) => Promise<void>;
  upgradeToPro: () => Promise<void>;
}

export const useBillingStore = create<BillingStore>((set, get) => ({
  subscription: null,
  transactions: [],
  creditsRemaining: 0,
  creditsTotal: 1000,
  loading: false,
  error: null,

  fetchBillingData: async () => {
    set({ loading: true, error: null });
    try {
      const [sub, txs] = await Promise.all([
        BillingRepository.getSubscription(),
        BillingRepository.getTransactions(),
      ]);

      // Free tier gets 50, pro gets more
      const creditsTotal = sub?.plan === 'free' ? 50 : 1000;
      const creditsRemaining = sub?.credits_remaining ?? 0;

      set({
        subscription: sub,
        transactions: txs || [],
        creditsRemaining,
        creditsTotal,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  consumeCredits: async (amount: number, description: string) => {
    try {
      await BillingRepository.consumeCredits(amount, description);
      await get().fetchBillingData();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  upgradeToPro: async () => {
    set({ loading: true, error: null });
    try {
      // Placeholder logic for Stripe checkout
      await get().fetchBillingData();
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
}));
