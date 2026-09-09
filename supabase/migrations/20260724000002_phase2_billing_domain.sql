-- ============================================================
-- Phase 2: New Billing Domain
-- ============================================================
-- Objective: Align database schema with the approved billing
-- architecture. Migrate existing tables, create missing ones,
-- add constraints, indexes, and RLS policies.
--
-- Changes:
--   1. subscriptions: make external_subscription_id/provider
--      NULLABLE for Free plan, add workspace_id UNIQUE
--   2. plans: add sort_order and monthly_credits
--   3. plan_limits: create new table
--   4. credit_buckets: add metadata column
--   5. credit_ledger: add metadata column
--   6. payment_events: add payload column
--   7. Add missing indexes for RLS performance
--   8. Add RLS policies for new/modified tables
-- ============================================================

-- ==========================================
-- 1. SUBSCRIPTIONS — Fix for Free plan
-- ==========================================
-- Free plan has no Stripe subscription, so external_subscription_id
-- and provider must be NULLABLE.

-- Drop the NOT NULL + UNIQUE constraint on external_subscription_id
-- and recreate as NULLABLE with a conditional unique index.
ALTER TABLE public.subscriptions
  ALTER COLUMN external_subscription_id DROP NOT NULL;

-- Drop the global UNIQUE constraint (allows only one row total)
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_external_subscription_id_key;

-- Add UNIQUE on workspace_id (one subscription per workspace)
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_workspace_id_unique UNIQUE (workspace_id);

-- Create a partial unique index: only enforce external_subscription_id uniqueness
-- when it's not NULL (paid plans have it, Free doesn't).
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_external_id
  ON public.subscriptions (external_subscription_id)
  WHERE external_subscription_id IS NOT NULL;

-- Make provider nullable for Free plan
ALTER TABLE public.subscriptions
  ALTER COLUMN provider DROP NOT NULL;

-- ==========================================
-- 2. PLANS — Add sort_order and monthly_credits
-- ==========================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS monthly_credits INTEGER NOT NULL DEFAULT 0;

-- Update existing plans with correct values
UPDATE public.plans SET sort_order = 0, monthly_credits = 0 WHERE code = 'free';
UPDATE public.plans SET sort_order = 1, monthly_credits = 500 WHERE code = 'go';
UPDATE public.plans SET sort_order = 2, monthly_credits = 2000 WHERE code = 'pro';
UPDATE public.plans SET sort_order = 3, monthly_credits = 10000 WHERE code = 'max';

-- ==========================================
-- 3. PLAN_LIMITS — New table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  daily_limit INTEGER,
  monthly_limit INTEGER,
  allowed_models JSONB DEFAULT '[]'::jsonb,
  max_tokens_per_request INTEGER,
  max_upload_size_mb INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, action_type)
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

-- Anyone can read plan limits (needed for frontend model selection)
CREATE POLICY "plan_limits_select_policy"
  ON public.plan_limits FOR SELECT
  USING (true);

-- Seed default limits for each plan
DO $$
DECLARE
  v_free_id UUID;
  v_go_id UUID;
  v_pro_id UUID;
  v_max_id UUID;
BEGIN
  SELECT id INTO v_free_id FROM public.plans WHERE code = 'free';
  SELECT id INTO v_go_id FROM public.plans WHERE code = 'go';
  SELECT id INTO v_pro_id FROM public.plans WHERE code = 'pro';
  SELECT id INTO v_max_id FROM public.plans WHERE code = 'max';

  -- Free: solo modelos gratuitos, sin créditos, límites bajos
  INSERT INTO public.plan_limits (plan_id, action_type, daily_limit, monthly_limit, allowed_models, max_tokens_per_request, max_upload_size_mb)
  VALUES
    (v_free_id, 'chat', 10, 100, '["gemini-1.5-flash"]'::jsonb, 4096, 10),
    (v_free_id, 'embedding', 0, 0, '[]'::jsonb, 0, 0),
    (v_free_id, 'knowledge_generation', 2, 20, '["gemini-1.5-flash"]'::jsonb, 4096, 10),
    (v_free_id, 'ocr', 5, 50, '[]'::jsonb, 0, 10);

  -- Go: modelos go + gratuitos, 500 créditos/mes
  INSERT INTO public.plan_limits (plan_id, action_type, daily_limit, monthly_limit, allowed_models, max_tokens_per_request, max_upload_size_mb)
  VALUES
    (v_go_id, 'chat', 50, 1500, '["gemini-1.5-flash", "gemini-1.5-pro"]'::jsonb, 8192, 50),
    (v_go_id, 'embedding', 100, 3000, '["text-embedding-3-small"]'::jsonb, 8192, 50),
    (v_go_id, 'knowledge_generation', 10, 100, '["gemini-1.5-flash", "gemini-1.5-pro"]'::jsonb, 8192, 50),
    (v_go_id, 'ocr', 20, 200, '[]'::jsonb, 0, 50);

  -- Pro: todos los modelos, 2000 créditos/mes
  INSERT INTO public.plan_limits (plan_id, action_type, daily_limit, monthly_limit, allowed_models, max_tokens_per_request, max_upload_size_mb)
  VALUES
    (v_pro_id, 'chat', 200, 6000, '["gemini-1.5-flash", "gemini-1.5-pro", "gpt-4o"]'::jsonb, 16384, 200),
    (v_pro_id, 'embedding', 500, 15000, '["text-embedding-3-small", "text-embedding-3-large"]'::jsonb, 16384, 200),
    (v_pro_id, 'knowledge_generation', 50, 500, '["gemini-1.5-flash", "gemini-1.5-pro", "gpt-4o"]'::jsonb, 16384, 200),
    (v_pro_id, 'ocr', 100, 1000, '[]'::jsonb, 0, 200);

  -- Max: todos los modelos + early access, 10000 créditos/mes
  INSERT INTO public.plan_limits (plan_id, action_type, daily_limit, monthly_limit, allowed_models, max_tokens_per_request, max_upload_size_mb)
  VALUES
    (v_max_id, 'chat', -1, -1, '["gemini-1.5-flash", "gemini-1.5-pro", "gpt-4o", "claude-3-opus"]'::jsonb, 32768, 500),
    (v_max_id, 'embedding', -1, -1, '["text-embedding-3-small", "text-embedding-3-large"]'::jsonb, 32768, 500),
    (v_max_id, 'knowledge_generation', -1, -1, '["gemini-1.5-flash", "gemini-1.5-pro", "gpt-4o", "claude-3-opus"]'::jsonb, 32768, 500),
    (v_max_id, 'ocr', -1, -1, '[]'::jsonb, 0, 500);
END $$;

-- ==========================================
-- 4. CREDIT_BUCKETS — Add metadata
-- ==========================================
ALTER TABLE public.credit_buckets
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ==========================================
-- 5. CREDIT_LEDGER — Add metadata
-- ==========================================
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ==========================================
-- 6. PAYMENT_EVENTS — Add payload
-- ==========================================
ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

-- ==========================================
-- 7. INDEXES — RLS performance
-- ==========================================
-- subscriptions: workspace lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id
  ON public.subscriptions (workspace_id);

-- credit_buckets: workspace + source lookups, FIFO ordering
CREATE INDEX IF NOT EXISTS idx_credit_buckets_workspace_source
  ON public.credit_buckets (workspace_id, source_type);

CREATE INDEX IF NOT EXISTS idx_credit_buckets_expires
  ON public.credit_buckets (workspace_id, expires_at)
  WHERE expires_at IS NOT NULL;

-- credit_ledger: workspace + type + date (circuit breaker query)
CREATE INDEX IF NOT EXISTS idx_credit_ledger_workspace_type_date
  ON public.credit_ledger (workspace_id, entry_type, created_at);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_workspace_id
  ON public.credit_ledger (workspace_id);

-- credit_accounts: workspace lookup (PK already covers this, but explicit)
-- No additional index needed (workspace_id is PK)

-- payment_events: workspace doesn't apply (system-wide), but event_type lookup
CREATE INDEX IF NOT EXISTS idx_payment_events_type
  ON public.payment_events (event_type);

-- plan_limits: plan lookup
CREATE INDEX IF NOT EXISTS idx_plan_limits_plan_id
  ON public.plan_limits (plan_id);

-- ==========================================
-- 8. RLS POLICIES
-- ==========================================

-- credit_buckets: workspace members can read
CREATE POLICY "credit_buckets_select_policy"
  ON public.credit_buckets FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- credit_ledger: workspace members can read (append-only, no insert/update/delete for users)
CREATE POLICY "credit_ledger_select_policy"
  ON public.credit_ledger FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- credit_reservations: workspace members can read
CREATE POLICY "credit_reservations_select_policy"
  ON public.credit_reservations FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- billing_customers: workspace members can read
CREATE POLICY "billing_customers_select_policy"
  ON public.billing_customers FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- purchases: workspace members can read
CREATE POLICY "purchases_select_policy"
  ON public.purchases FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- credit_packages: public read (already exists, verify)
-- payment_events: service_role only (no user read needed)

-- ==========================================
-- 9. SEED: Update plan display names
-- ==========================================
UPDATE public.plans SET display_name = 'Free' WHERE code = 'free';
UPDATE public.plans SET display_name = 'Go' WHERE code = 'go';
UPDATE public.plans SET display_name = 'Pro' WHERE code = 'pro';
UPDATE public.plans SET display_name = 'Max' WHERE code = 'max';
