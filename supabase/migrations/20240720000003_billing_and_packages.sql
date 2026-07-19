-- Phase 19: Billing and Packages

-- ==========================================
-- 1. CREDIT PACKAGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL,
  price_usd NUMERIC(10, 2) NOT NULL,
  stripe_price_id TEXT, -- For real checkout
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. SUBSCRIPTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  plan_code TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'canceled'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. PURCHASES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID,
  package_id UUID REFERENCES public.credit_packages(id),
  stripe_session_id TEXT UNIQUE,
  amount_usd NUMERIC(10, 2) NOT NULL,
  credits_granted INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ==========================================
-- TRIGGERS & RLS
-- ==========================================
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read active credit packages" ON public.credit_packages FOR SELECT USING (is_active = true);

CREATE POLICY "Users can read their workspace subscriptions" ON public.subscriptions 
FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Users can read their workspace purchases" ON public.purchases 
FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- ==========================================
-- SEED DATA
-- ==========================================
INSERT INTO public.credit_packages (name, description, credits, price_usd, stripe_price_id) VALUES 
('Starter Pack', 'Perfect for a few quick tasks.', 1000, 5.00, 'price_starter_mock'),
('Pro Pack', 'Best value for heavy researchers.', 5000, 20.00, 'price_pro_mock')
ON CONFLICT DO NOTHING;
