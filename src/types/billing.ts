export type PlanType = 'free' | 'go' | 'pro' | 'max';

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

// ─── Product definition (PROVISIONAL pricing) ────────────────────────
// Only the Free tier's $0 and 0 AI credits are confirmed product decisions.
// 'go' and 'max' exist in the plans table but have no confirmed product
// definition yet — they are intentionally absent here until defined.
// Features listed are those that exist in the product today; no unshipped
// promises. Pricing owners must confirm before any real checkout goes live.
export const PLANS: Partial<Record<PlanType, SubscriptionPlan>> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    monthlyCredits: 0,
    allowedModels: [],
    features: [
      'PDF reading & viewer',
      'Manual highlights & notes',
      'Works with zero AI credits',
      'No included AI credits'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 15, // PROVISIONAL — unconfirmed pricing
    monthlyCredits: 1000,
    allowedModels: ['gemini-flash-latest', 'gemini-pro-latest'],
    features: [
      '1,000 AI Credits / month',
      'AI Highlights (semantic)',
      'AI chat with your documents',
      'Everything in Free'
    ]
  }
};

export const AVAILABLE_MODELS: { code: string; name: string; requiredPlan: PlanType }[] = [
  { code: 'gemini-flash-latest', name: 'Gemini Flash (Fast)', requiredPlan: 'free' },
  { code: 'gemini-pro-latest', name: 'Gemini Pro (Advanced)', requiredPlan: 'pro' },
];
