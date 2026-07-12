export type PlanType = 'free' | 'pro';

export interface SubscriptionPlan {
  id: PlanType;
  name: string;
  price: number;
  monthlyCredits: number;
  features: string[];
}

export interface Transaction {
  id: string;
  type: 'grant' | 'purchase' | 'usage';
  amount: number; // positive for adding credits, negative for usage
  description: string;
  createdAt: number;
}

export interface BillingState {
  currentPlan: PlanType;
  creditsRemaining: number;
  transactions: Transaction[];
}

export const PLANS: Record<PlanType, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    monthlyCredits: 50,
    features: ['50 AI Queries / month', '3 Workspaces', 'Standard Processing']
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 15,
    monthlyCredits: 1000,
    features: ['1000 AI Queries / month', 'Unlimited Workspaces', 'Priority Processing', 'Early Access Features']
  }
};
