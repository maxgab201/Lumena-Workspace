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
    allowedModels: ['gemini-1.5-flash'],
    features: ['50 AI Queries / month', '3 Workspaces', 'Standard Processing', 'Gemini 1.5 Flash only']
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 15,
    monthlyCredits: 1000,
    allowedModels: ['gemini-1.5-flash', 'gemini-1.5-pro'],
    features: ['1000 AI Queries / month', 'Unlimited Workspaces', 'Priority Processing', 'Early Access Features', 'Gemini 1.5 Pro access']
  }
};

export const AVAILABLE_MODELS: { code: string; name: string; requiredPlan: PlanType }[] = [
  { code: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)', requiredPlan: 'free' },
  { code: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Advanced)', requiredPlan: 'pro' },
];

