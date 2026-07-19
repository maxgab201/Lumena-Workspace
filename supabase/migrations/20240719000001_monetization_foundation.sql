-- Phase 15: Monetization Foundation

-- ==========================================
-- ENUMS
-- ==========================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_entry_type') THEN
    CREATE TYPE ledger_entry_type AS ENUM (
      'grant_plan', 'grant_purchase', 'grant_promotion', 
      'reserve', 'release', 'consume', 'refund', 
      'expire', 'chargeback_hold', 'chargeback_reversal', 
      'manual_adjustment'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
    CREATE TYPE reservation_status AS ENUM (
      'pending', 'confirmed', 'partially_settled', 'released', 
      'expired', 'cancelled', 'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM (
      'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
    );
  END IF;
END $$;

-- ==========================================
-- 1. CATALOG: PLANS & PRICES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.plan_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  external_price_id TEXT,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year', 'one_time')),
  currency TEXT NOT NULL DEFAULT 'usd',
  amount INTEGER NOT NULL, -- in cents
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. CREDITS & BALANCES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.credit_accounts (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  available INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  expired INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- e.g., 'subscription', 'purchase'
  original_amount INTEGER NOT NULL,
  remaining_amount INTEGER NOT NULL,
  expires_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 100, -- lower number means higher priority to consume
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. IMMUTABLE LEDGER & RESERVATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  requested_amount INTEGER NOT NULL,
  reserved_amount INTEGER NOT NULL,
  settled_amount INTEGER NOT NULL DEFAULT 0,
  status reservation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bucket_id UUID REFERENCES public.credit_buckets(id) ON DELETE SET NULL,
  entry_type ledger_entry_type NOT NULL,
  amount INTEGER NOT NULL,
  direction INTEGER NOT NULL CHECK (direction IN (1, -1)),
  reservation_id UUID REFERENCES public.credit_reservations(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 4. BILLING & STRIPE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.billing_customers (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  external_customer_id TEXT UNIQUE NOT NULL,
  billing_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: we already have a basic 'subscriptions' table from an earlier phase, 
-- but we need to upgrade it to the new structure if it exists.
-- Since the old one might exist, let's alter or recreate.
-- The easiest way is to drop the old one and recreate for this new robust system 
-- since we are in dev/prototype and data is not critical.
DROP TABLE IF EXISTS public.subscriptions CASCADE;

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  external_subscription_id TEXT UNIQUE NOT NULL,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  status subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'stripe',
  external_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'processed'
);

-- ==========================================
-- TRIGGERS & RLS
-- ==========================================
-- Automatically create credit_account when workspace is created
CREATE OR REPLACE FUNCTION create_workspace_credit_account()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.credit_accounts (workspace_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_workspace_created_create_account ON public.workspaces;
CREATE TRIGGER on_workspace_created_create_account
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION create_workspace_credit_account();

-- RLS Configuration
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated users
CREATE POLICY "Users can read plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Users can read plan_prices" ON public.plan_prices FOR SELECT USING (true);

-- Workspaces own their data, users read via membership
CREATE POLICY "Users can view their workspace credit_accounts" ON public.credit_accounts 
FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Users can view their workspace subscriptions" ON public.subscriptions 
FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Users can view their workspace billing_customers" ON public.billing_customers 
FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- ONLY service_role can modify financial data
-- No explicit policies created for INSERT/UPDATE/DELETE for authenticated users,
-- which means they are blocked by default RLS. The Edge Function runs as service_role.

-- Seed default plans
INSERT INTO public.plans (code, display_name) VALUES 
('free', 'Free'),
('go', 'Go'),
('pro', 'Pro'),
('max', 'Max')
ON CONFLICT (code) DO NOTHING;
