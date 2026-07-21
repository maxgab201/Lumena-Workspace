export type PlanType = 'free' | 'pro';

export interface SubscriptionPlan {
  id: PlanType;
  name: string;
  price: number;
  monthlyCredits: number;
  allowedModels: string[];
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
    allowedModels: [],
    features: ['50 AI Queries / month', '3 Workspaces', 'Standard Processing']
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 15,
    monthlyCredits: 1000,
    allowedModels: [],
    features: ['1000 AI Queries / month', 'Unlimited Workspaces', 'Priority Processing', 'Early Access Features']
  }
};

export const AVAILABLE_MODELS: { code: string; name: string; requiredPlan: PlanType }[] = [];

