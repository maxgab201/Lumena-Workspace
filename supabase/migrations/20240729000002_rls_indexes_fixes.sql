-- ==========================================
-- MIGRATION: Fix RLS policies, add missing indexes, consolidate subscriptions
-- ==========================================

-- ==========================================
-- 0. ENSURE payment_events HAS workspace_id BEFORE REFERENCING IT IN POLICIES
-- ==========================================
ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.payment_events pe
SET workspace_id = p.workspace_id
FROM public.purchases p
WHERE pe.workspace_id IS NULL
  AND p.stripe_session_id = pe.external_event_id;

-- ==========================================
-- 1. FIX RLS POLICIES FOR BILLING TABLES
-- ==========================================

-- credit_accounts: already has SELECT policy, need to ensure it uses get_user_workspace_ids
-- (already done in monetization_foundation.sql)

-- credit_buckets: ADD SELECT policy
DROP POLICY IF EXISTS "Users can view their workspace credit buckets" ON public.credit_buckets;
CREATE POLICY "Users can view their workspace credit buckets" ON public.credit_buckets
  FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- credit_reservations: ADD SELECT policy
DROP POLICY IF EXISTS "Users can view their workspace credit reservations" ON public.credit_reservations;
CREATE POLICY "Users can view their workspace credit reservations" ON public.credit_reservations
  FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- credit_ledger: ADD SELECT policy
DROP POLICY IF EXISTS "Users can view their workspace credit ledger" ON public.credit_ledger;
CREATE POLICY "Users can view their workspace credit ledger" ON public.credit_ledger
  FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- billing_customers: ADD SELECT policy (already has one in monetization_foundation but verify)
-- Already has: CREATE POLICY "Users can view their workspace billing_customers" ON public.billing_customers FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- payment_events: ADD SELECT policy (TABLE HAS RLS ENABLED BUT NO POLICIES!)
DROP POLICY IF EXISTS "Users can view their workspace payment events" ON public.payment_events;
CREATE POLICY "Users can view their workspace payment events" ON public.payment_events
  FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- subscriptions: ADD SELECT policy (already has one but verify)
-- Already has in monetization_foundation.sql: CREATE POLICY "Users can view their workspace subscriptions" ON public.subscriptions FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- credit_buckets, credit_reservations, credit_ledger: Service role only for writes (default RLS blocks)
-- This is intentional - only Edge Functions (service_role) should write to these

-- payment_events: Service role only for writes (default RLS blocks) - intentional for webhook

-- ==========================================
-- 2. FIX DUPLICATE SUBSCRIPTIONS TABLE
-- ==========================================
-- The subscriptions table is defined in 3 migrations:
-- 1. 20240711000006_billing.sql (old - user_id FK, credits_remaining)
-- 2. 20240719000001_monetization_foundation.sql (DROPs old, creates new with workspace_id FK)
-- 3. 20240720000003_billing_and_packages.sql (creates AGAIN with different schema)

-- The issue: 20240720000003 creates a subscriptions table AGAIN with different columns
-- We need to remove the duplicate creation in 20240720000003

-- Since we can't edit historical migrations, we'll add a correction migration here
-- The latest migration (20240720000003) defines:
--   id, workspace_id, provider, external_subscription_id, plan_code, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at

-- This is the CORRECT schema - remove any old references
-- The trigger in 20240711000006_billing.sql (handle_new_user_subscription) references the OLD schema
-- That trigger will fail because the old table was DROPed

-- Fix: Update the trigger to work with new schema or remove it
-- We'll DROP the old trigger and create a new one

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

-- The new trigger should create subscription with proper new schema
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Get or create workspace for user (should already exist via handle_new_user)
  -- Insert subscription with default free plan
  INSERT INTO public.subscriptions (workspace_id, provider, external_subscription_id, plan_code, status)
  SELECT w.id, 'stripe', gen_random_uuid()::TEXT, 'free', 'active'
  FROM public.workspaces w
  JOIN public.workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.user_id = NEW.id
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- ==========================================
-- 3. ADD MISSING INDEXES
-- ==========================================

-- credit_ledger: critical for monthly/daily quota queries in ai-gateway
CREATE INDEX IF NOT EXISTS idx_credit_ledger_workspace_entry_created
  ON public.credit_ledger (workspace_id, entry_type, created_at DESC);

-- credit_ledger: for monthly quota check (entry_type = 'consume' AND created_at >= month_start)
CREATE INDEX IF NOT EXISTS idx_credit_ledger_workspace_consume_created
  ON public.credit_ledger (workspace_id, created_at DESC)
  WHERE entry_type = 'consume';

-- credit_ledger: for daily circuit breaker check
CREATE INDEX IF NOT EXISTS idx_credit_ledger_workspace_consume_daily
  ON public.credit_ledger (workspace_id, created_at DESC)
  WHERE entry_type = 'consume';

-- credit_buckets: for priority-based consumption
CREATE INDEX IF NOT EXISTS idx_credit_buckets_workspace_priority
  ON public.credit_buckets (workspace_id, priority, remaining_amount)
  WHERE remaining_amount > 0;

-- credit_reservations: for expiration cleanup and status checks
CREATE INDEX IF NOT EXISTS idx_credit_reservations_workspace_status
  ON public.credit_reservations (workspace_id, status, expires_at);

-- credit_reservations: for expiration cleanup job
CREATE INDEX IF NOT EXISTS idx_credit_reservations_expires_pending
  ON public.credit_reservations (expires_at)
  WHERE status = 'pending';

-- usage_jobs: for analytics and monitoring (usage_jobs has started_at, not created_at)
CREATE INDEX IF NOT EXISTS idx_usage_jobs_workspace_action_created
  ON public.usage_jobs (workspace_id, action_type, started_at DESC);

-- usage_jobs: for model-specific analytics
CREATE INDEX IF NOT EXISTS idx_usage_jobs_workspace_model_status
  ON public.usage_jobs (workspace_id, model_id, status);

-- processing_jobs: already has idx_processing_jobs_workspace_id, idx_processing_jobs_document_id
-- Add composite for status + created_at
CREATE INDEX IF NOT EXISTS idx_processing_jobs_workspace_status_created
  ON public.processing_jobs (workspace_id, status, created_at DESC);

-- documents: already has idx_documents_workspace_id, idx_documents_workspace_status
-- Add for sorting
CREATE INDEX IF NOT EXISTS idx_documents_workspace_created_desc
  ON public.documents (workspace_id, created_at DESC);

-- chat_sessions: for session listing
CREATE INDEX IF NOT EXISTS idx_chat_sessions_workspace_updated
  ON public.chat_sessions (workspace_id, updated_at DESC);

-- chat_messages: for message history loading
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON public.chat_messages (session_id, created_at ASC);

-- highlights: for document highlights
CREATE INDEX IF NOT EXISTS idx_highlights_document_page
  ON public.highlights (document_id, page_index);

-- security_events: for audit queries
CREATE INDEX IF NOT EXISTS idx_security_events_workspace_type_created
  ON public.security_events (workspace_id, event_type, created_at DESC);

-- rate_limit_counters: already has unique constraint but add composite for queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_workspace_metric
  ON public.rate_limit_counters (scope_id, metric, window_start);

-- ==========================================
-- 4. ADD CHECK CONSTRAINTS
-- ==========================================

-- subscriptions: add plan_code column (denormalized from plans.code for fast gateway checks)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_code TEXT;

UPDATE public.subscriptions s
SET plan_code = p.code
FROM public.plans p
WHERE s.plan_id = p.id AND (s.plan_code IS NULL OR s.plan_code = '');

UPDATE public.subscriptions
SET plan_code = 'free'
WHERE plan_code IS NULL;

ALTER TABLE public.subscriptions
  ALTER COLUMN plan_code SET NOT NULL,
  ALTER COLUMN plan_code SET DEFAULT 'free';

-- credit_accounts: non-negative balances
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_credit_accounts_nonnegative') THEN
    ALTER TABLE public.credit_accounts
      ADD CONSTRAINT check_credit_accounts_nonnegative
      CHECK (available >= 0 AND reserved >= 0 AND consumed >= 0 AND expired >= 0);
  END IF;
END $$;

-- credit_buckets: non-negative amounts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_credit_buckets_nonnegative') THEN
    ALTER TABLE public.credit_buckets
      ADD CONSTRAINT check_credit_buckets_nonnegative
      CHECK (original_amount >= 0 AND remaining_amount >= 0 AND priority > 0);
  END IF;
END $$;

-- credit_reservations: non-negative amounts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_credit_reservations_nonnegative') THEN
    ALTER TABLE public.credit_reservations
      ADD CONSTRAINT check_credit_reservations_nonnegative
      CHECK (requested_amount >= 0 AND reserved_amount >= 0 AND settled_amount >= 0);
  END IF;
END $$;

-- credit_ledger: amount positive
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_credit_ledger_amount_positive') THEN
    ALTER TABLE public.credit_ledger
      ADD CONSTRAINT check_credit_ledger_amount_positive
      CHECK (amount > 0);
  END IF;
END $$;

-- subscriptions: valid status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_subscriptions_status') THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT check_subscriptions_status
      CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'));
  END IF;
END $$;

-- subscriptions: valid plan_code
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_subscriptions_plan_code') THEN
    -- Map legacy subscription_status values that may not fit the enum list above
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT check_subscriptions_plan_code
      CHECK (plan_code IN ('free', 'go', 'pro', 'max'));
  END IF;
END $$;

-- ==========================================
-- 5. payment_events workspace_id (handled in section 0 above)
-- ==========================================

-- Add index for the workspace_id column added in section 0
CREATE INDEX IF NOT EXISTS idx_payment_events_workspace_created
  ON public.payment_events (workspace_id, processed_at DESC);

-- ==========================================
-- 6. ENSURE updated_at TRIGGERS ON ALL TABLES
-- ==========================================

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables missing it
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
    AND table_schema = 'public'
    AND table_name IN (
      'credit_accounts', 'credit_buckets', 'credit_reservations', 'credit_ledger',
      'billing_customers', 'subscriptions', 'payment_events',
      'usage_jobs', 'providers', 'provider_models', 'provider_pricing',
      'processing_jobs', 'processing_events', 'processing_logs',
      'chat_sessions', 'chat_messages',
      'highlights', 'highlight_categories',
      'flashcards', 'glossary_terms', 'mind_map_nodes', 'timeline_events',
      'security_events', 'rate_limit_counters'
    )
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I;
      CREATE TRIGGER update_%s_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END $$;