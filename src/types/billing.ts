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
    monthlyCredits: 0,
    allowedModels: [],
    features: [
      'Standard PDF reading & viewing',
      'Manual highlights & notes',
      'Up to 3 Workspaces',
      'No included AI credits'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 15,
    monthlyCredits: 1000,
    allowedModels: ['gemini-flash-latest', 'gemini-pro-latest'],
    features: [
      '1,000 AI Credits / month',
      'Unlimited Workspaces',
      'Priority Processing',
      'AI Highlights & Analysis',
      'Gemini 1.5 Pro & Flash access'
    ]
  }
};

export const AVAILABLE_MODELS: { code: string; name: string; requiredPlan: PlanType }[] = [
  { code: 'gemini-flash-latest', name: 'Gemini Flash (Fast)', requiredPlan: 'free' },
  { code: 'gemini-pro-latest', name: 'Gemini Pro (Advanced)', requiredPlan: 'pro' },
];
