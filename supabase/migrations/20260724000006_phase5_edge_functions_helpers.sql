-- ============================================================
-- Phase 5: Edge Functions Integration
-- ============================================================
-- Objective: Update all Edge Functions to use the new atomic RPCs
-- instead of manual optimistic locking patterns.
--
-- This migration creates helper functions and updates Edge Functions
-- to use the new RPCs for all credit operations.
-- ============================================================

-- ==========================================
-- 1. CREDIT CONSUMPTION HELPER FOR EDGE FUNCTIONS
-- ==========================================
-- Simple wrapper that Edge Functions can call to consume credits
-- in a single atomic operation.
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_workspace_id UUID,
  p_amount INTEGER,
  p_entry_type ledger_entry_type DEFAULT 'consume',
  p_reservation_id UUID DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT, new_available INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id UUID;
BEGIN
  -- If amount is 0 or negative, do nothing but return success
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT true, 'No credits to consume', available::INTEGER
    FROM public.credit_accounts WHERE workspace_id = p_workspace_id;
  END IF;

  -- If no reservation provided, create one and settle it in one transaction
  IF p_reservation_id IS NULL THEN
    v_reservation_id := public.reserve_credits(
      p_workspace_id, p_amount,
      p_idempotency_key || ':consume', NULL, 300
    );
    
    PERFORM public.settle_credits(v_reservation_id, p_amount);
  ELSE
    PERFORM public.settle_credits(p_reservation_id, p_amount);
    v_reservation_id := p_reservation_id;
  END IF;

  RETURN QUERY
  SELECT true, 'Credits consumed', available::INTEGER
  FROM public.get_workspace_balance(p_workspace_id);
END;
$$;

-- ==========================================
-- 2. CREDIT RESERVATION HELPER FOR EDGE FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.reserve_credits_simple(
  p_workspace_id UUID,
  p_amount INTEGER,
  p_job_id UUID DEFAULT NULL,
  p_ttl_seconds INTEGER DEFAULT 300,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.reserve_credits(
    p_workspace_id, p_amount,
    p_idempotency_key, p_job_id, p_ttl_seconds
  );
END;
$$;

-- ==========================================
-- 3. CREDIT SETTLEMENT HELPER FOR EDGE FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.settle_credits_simple(
  p_reservation_id UUID,
  p_actual_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.settle_credits(p_reservation_id, p_actual_amount);
END;
$$;

-- ==========================================
-- 4. CREDIT RELEASE HELPER FOR EDGE FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.release_credits_simple(
  p_reservation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.release_credits(p_reservation_id);
END;
$$;

-- ==========================================
-- 5. GRANT CREDITS HELPER FOR EDGE FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.grant_credits_simple(
  p_workspace_id UUID,
  p_amount INTEGER,
  p_source TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_priority INTEGER DEFAULT 100,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.grant_credits(
    p_workspace_id, p_amount, p_source,
    p_expires_at, p_priority, p_idempotency_key
  );
END;
$$;

-- ==========================================
-- 6. EXPIRE CREDITS HELPER FOR EDGE FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.expire_credits_simple(
  p_workspace_id UUID
)
RETURNS TABLE(expired_count INTEGER, expired_amount INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.expire_workspace_credits(p_workspace_id);
END;
$$;

-- ==========================================
-- 7. GET BALANCE HELPER FOR EDGE FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_balance_simple(
  p_workspace_id UUID
)
RETURNS TABLE(
  available INTEGER,
  reserved INTEGER,
  consumed INTEGER,
  expired INTEGER,
  active_buckets INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.get_workspace_balance(p_workspace_id);
END;
$$;

-- ==========================================
-- GRANTS FOR EDGE FUNCTIONS (service_role)
-- ==========================================
GRANT EXECUTE ON FUNCTION public.consume_credits(UUID, INTEGER, ledger_entry_type, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_credits_simple(UUID, INTEGER, UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_credits_simple(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_credits_simple(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits_simple(UUID, INTEGER, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_credits_simple(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_balance_simple(UUID) TO service_role;