import { create } from 'zustand';
import type { PlanType, Transaction } from '../types/billing';
import { PLANS } from '../types/billing';

interface BillingStoreState {
  currentPlan: PlanType;
  creditsRemaining: number;
  transactions: Transaction[];
  
  // Actions
  consumeCredits: (amount: number, description: string) => boolean;
  purchaseCredits: (amount: number, description: string) => void;
  upgradePlan: (plan: PlanType) => void;
}

export const useBillingStore = create<BillingStoreState>((set, get) => ({
  currentPlan: 'free',
  creditsRemaining: PLANS.free.monthlyCredits,
  transactions: [{
    id: crypto.randomUUID(),
    type: 'grant',
    amount: PLANS.free.monthlyCredits,
    description: 'Initial Free Tier Grant',
    createdAt: Date.now()
  }],

  consumeCredits: (amount, description) => {
    const { creditsRemaining, transactions } = get();
    if (creditsRemaining < amount) {
      return false; // Not enough credits
    }
    
    set({
      creditsRemaining: creditsRemaining - amount,
      transactions: [
        {
          id: crypto.randomUUID(),
          type: 'usage',
          amount: -amount,
          description,
          createdAt: Date.now()
        },
        ...transactions
      ]
    });
    return true;
  },

  purchaseCredits: (amount, description) => set((state) => ({
    creditsRemaining: state.creditsRemaining + amount,
    transactions: [
      {
        id: crypto.randomUUID(),
        type: 'purchase',
        amount,
        description,
        createdAt: Date.now()
      },
      ...state.transactions
    ]
  })),

  upgradePlan: (plan) => set((state) => ({
    currentPlan: plan,
    creditsRemaining: state.creditsRemaining + PLANS[plan].monthlyCredits,
    transactions: [
      {
        id: crypto.randomUUID(),
        type: 'grant',
        amount: PLANS[plan].monthlyCredits,
        description: `Upgrade to ${PLANS[plan].name} Plan`,
        createdAt: Date.now()
      },
      ...state.transactions
    ]
  }))
}));
