-- ============================================================
-- Phase 1: Stabilization
-- ============================================================
-- Objective: Fix broken signup, remove dead code, stabilize system.
--
-- Problems fixed:
--   1. Trigger `on_auth_user_created_subscription` fires on every
--      signup but INSERTs into subscriptions with columns that
--      don't exist (user_id, plan, credits_remaining). This
--      BLOCKS all new user signups.
--   2. Function `handle_new_user_subscription` references the old
--      schema. It must be dropped.
--   3. Function `consume_credits` references the old schema
--      (subscriptions.credits_remaining, transactions table).
--      It must be dropped.
--   4. Table `transactions` is a legacy artifact from the old
--      billing system. It is replaced by `credit_ledger`.
-- ============================================================

-- 1. Drop the broken trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

-- 2. Drop the broken function
DROP FUNCTION IF EXISTS public.handle_new_user_subscription();

-- 3. Drop the obsolete consume_credits function (old schema reference)
DROP FUNCTION IF EXISTS public.consume_credits(uuid, integer, text);

-- 4. Drop the legacy transactions table (replaced by credit_ledger)
DROP TABLE IF EXISTS public.transactions CASCADE;

-- ============================================================
-- Verification: The following triggers must still exist:
--   - on_auth_user_created (handle_new_user)
--   - on_auth_user_created_settings (handle_new_user_settings)
--   - on_workspace_created_create_account (create_workspace_credit_account)
--   - on_workspace_created_seed_categories
-- ============================================================
