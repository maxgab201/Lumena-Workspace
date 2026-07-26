-- ============================================================
-- Phase 3: Security Hardening
-- ============================================================
-- Objective: Clean up duplicate policies, add CHECK constraints,
-- ensure all financial tables have proper RLS, validate integrity.
--
-- Changes:
--   1. Drop duplicate SELECT policies (old migration leftovers)
--   2. Add CHECK constraints for data integrity
--   3. Verify RLS completeness
--   4. Add missing indexes for security queries
-- ============================================================

-- ==========================================
-- 1. DROP DUPLICATE SELECT POLICIES
-- ==========================================
-- These are leftovers from old migrations. The newer policies
-- (with cleaner names) are kept. Duplicates are harmless but
-- make auditing harder.

-- billing_customers: keep "billing_customers_select_policy"
DROP POLICY IF EXISTS "Users can view their workspace billing_customers" ON public.billing_customers;

-- purchases: keep "purchases_select_policy"
DROP POLICY IF EXISTS "Users can read their workspace purchases" ON public.purchases;

-- subscriptions: keep "Users can view their workspace subscriptions"
DROP POLICY IF EXISTS "Users can read their workspace subscriptions" ON public.subscriptions;

-- ==========================================
-- 2. CHECK CONSTRAINTS — Data Integrity
-- ==========================================

-- credit_buckets: remaining_amount must be >= 0 and <= original_amount
ALTER TABLE public.credit_buckets
  ADD CONSTRAINT credit_buckets_amounts_check
  CHECK (remaining_amount >= 0 AND remaining_amount <= original_amount);

-- credit_buckets: original_amount must be positive
ALTER TABLE public.credit_buckets
  ADD CONSTRAINT credit_buckets_original_amount_check
  CHECK (original_amount > 0);

-- credit_accounts: all counters must be >= 0
ALTER TABLE public.credit_accounts
  ADD CONSTRAINT credit_accounts_non_negative_check
  CHECK (available >= 0 AND reserved >= 0 AND consumed >= 0 AND expired >= 0);

-- subscriptions: current_period_end must be after current_period_start (when both set)
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_period_check
  CHECK (current_period_start IS NULL OR current_period_end IS NULL OR current_period_end > current_period_start);

-- plan_limits: limits must be -1 (unlimited) or >= 0
ALTER TABLE public.plan_limits
  ADD CONSTRAINT plan_limits_daily_check
  CHECK (daily_limit = -1 OR daily_limit >= 0);

ALTER TABLE public.plan_limits
  ADD CONSTRAINT plan_limits_monthly_check
  CHECK (monthly_limit = -1 OR monthly_limit >= 0);

ALTER TABLE public.plan_limits
  ADD CONSTRAINT plan_limits_tokens_check
  CHECK (max_tokens_per_request IS NULL OR max_tokens_per_request >= 0);

ALTER TABLE public.plan_limits
  ADD CONSTRAINT plan_limits_upload_check
  CHECK (max_upload_size_mb IS NULL OR max_upload_size_mb >= 0);

-- plans: monthly_credits must be >= 0
ALTER TABLE public.plans
  ADD CONSTRAINT plans_monthly_credits_check
  CHECK (monthly_credits >= 0);

-- plans: sort_order must be >= 0
ALTER TABLE public.plans
  ADD CONSTRAINT plans_sort_order_check
  CHECK (sort_order >= 0);

-- purchases: amount_usd must be positive
ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_amount_check
  CHECK (amount_usd > 0);

-- purchases: credits_granted must be positive
ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_credits_check
  CHECK (credits_granted > 0);

-- ==========================================
-- 3. INDEXES — Security Query Performance
-- ==========================================

-- credit_ledger: idempotency check (already has UNIQUE, but explicit cover)
-- payment_events: event_type lookup for webhook processing
-- (already created in Phase 2)

-- subscriptions: status lookup for lazy init
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions (status);

-- credit_buckets: workspace + expires for FIFO consumption
-- (already created in Phase 2)

-- ==========================================
-- 4. VALIDATE EXISTING DATA
-- ==========================================
-- Ensure no orphaned credit_buckets (workspace must exist)
-- This is enforced by FK, but let's verify no data issues

DO $$
BEGIN
  -- Verify credit_buckets FK integrity
  IF EXISTS (
    SELECT 1 FROM public.credit_buckets cb
    WHERE NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = cb.workspace_id)
  ) THEN
    RAISE EXCEPTION 'Orphaned credit_buckets found';
  END IF;

  -- Verify credit_ledger FK integrity
  IF EXISTS (
    SELECT 1 FROM public.credit_ledger cl
    WHERE cl.bucket_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.credit_buckets cb WHERE cb.id = cl.bucket_id)
  ) THEN
    RAISE EXCEPTION 'Orphaned credit_ledger entries (bucket_id) found';
  END IF;

  -- Verify subscriptions FK integrity
  IF EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = s.workspace_id)
  ) THEN
    RAISE EXCEPTION 'Orphaned subscriptions found';
  END IF;
END $$;
