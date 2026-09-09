-- ============================================================
-- Phase 4: Financial RPCs (Atomic Operations)
-- ============================================================
-- Objective: Implement atomic credit operations that the
-- backend MUST use for all financial state changes.
--
-- Guarantees:
--   1. SELECT ... FOR UPDATE prevents race conditions
--   2. All operations in a single transaction
--   3. Idempotency via unique keys
--   4. SECURITY DEFINER + search_path set
--   5. Grant access only to service_role (Edge Functions)
-- ============================================================

-- ==========================================
-- 1. EXPIRE_WORKSPACE_CREDITS
-- ==========================================
-- Marks all expired subscription buckets as expired and
-- updates credit_accounts.expired counter. Called by Stripe
-- webhook on subscription renewal.
CREATE OR REPLACE FUNCTION public.expire_workspace_credits(p_workspace_id UUID)
RETURNS TABLE(expired_count INTEGER, expired_amount INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER;
  v_expired_amount INTEGER;
BEGIN
  -- Lock the credit_accounts row
  PERFORM 1 FROM public.credit_accounts
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;

  -- Find and update expired subscription buckets
  UPDATE public.credit_buckets
  SET remaining_amount = 0
  WHERE workspace_id = p_workspace_id
    AND source_type = 'subscription'
    AND expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND remaining_amount > 0;

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Calculate how many credits expired
  SELECT COALESCE(SUM(remaining_amount), 0)
  INTO v_expired_amount
  FROM public.credit_buckets
  WHERE workspace_id = p_workspace_id
    AND source_type = 'subscription'
    AND expires_at IS NOT NULL
    AND expires_at <= NOW();

  -- Update credit_accounts.expired counter (INCREMENT, not overwrite)
  UPDATE public.credit_accounts
  SET expired = expired + v_expired_amount,
      updated_at = NOW()
  WHERE workspace_id = p_workspace_id;

  -- Record ledger entries for each expired bucket
  INSERT INTO public.credit_ledger (workspace_id, bucket_id, entry_type, amount, direction, idempotency_key, metadata)
  SELECT
    p_workspace_id,
    cb.id,
    'expire'::ledger_entry_type,
    -cb.remaining_amount,
    -1,
    'expire:' || cb.id::text,
    jsonb_build_object('expired_at', NOW())
  FROM public.credit_buckets cb
  WHERE cb.workspace_id = p_workspace_id
    AND cb.source_type = 'subscription'
    AND cb.expires_at IS NOT NULL
    AND cb.expires_at <= NOW()
    AND cb.remaining_amount > 0
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN QUERY SELECT v_expired_count, v_expired_amount;
END;
$$;

-- ==========================================
-- 2. RESERVE_CREDITS
-- ==========================================
-- Atomic credit reservation using FIFO across buckets.
-- Creates a credit_reservations row and returns the reservation_id.
-- Decreases bucket remaining_amount and credit_accounts available.
--
-- Idempotency: If p_idempotency_key already exists, returns the
-- existing reservation_id without creating a new one.
CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_workspace_id UUID,
  p_amount INTEGER,
  p_idempotency_key TEXT,
  p_job_id UUID DEFAULT NULL,
  p_ttl_seconds INTEGER DEFAULT 300
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id UUID;
  v_available INTEGER;
  v_remaining INTEGER;
  v_bucket_id UUID;
  v_take INTEGER;
  v_reserved_total INTEGER := 0;
  v_amount_needed INTEGER;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Reserve amount must be positive';
  END IF;

  -- Idempotency check: if a pending reservation with this key exists, return it
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_reservation_id
    FROM public.credit_reservations
    WHERE workspace_id = p_workspace_id
      AND idempotency_key = p_idempotency_key
      AND status = 'pending'::reservation_status
    LIMIT 1;

    IF v_reservation_id IS NOT NULL THEN
      RETURN v_reservation_id;
    END IF;
  END IF;

  v_amount_needed := p_amount;

  -- Lock the credit_accounts row
  SELECT available INTO v_available
  FROM public.credit_accounts
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;

  IF v_available IS NULL THEN
    RAISE EXCEPTION 'Workspace credentials not found';
  END IF;

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: available=%, requested=%', v_available, p_amount;
  END IF;

  -- Create the reservation FIRST (so we can reference its id in the ledger)
  INSERT INTO public.credit_reservations (
    workspace_id, job_id, requested_amount, reserved_amount, status, expires_at, idempotency_key
  ) VALUES (
    p_workspace_id, p_job_id, p_amount, p_amount,
    'pending'::reservation_status,
    NOW() + (p_ttl_seconds || ' seconds')::INTERVAL,
    p_idempotency_key
  )
  RETURNING id INTO v_reservation_id;

  -- FIFO consumption: deduct from buckets in priority order
  FOR v_bucket_id IN
    SELECT id FROM public.credit_buckets
    WHERE workspace_id = p_workspace_id
      AND remaining_amount > 0
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY priority ASC, expires_at ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_amount_needed <= 0;

    SELECT remaining_amount INTO v_remaining
    FROM public.credit_buckets
    WHERE id = v_bucket_id;

    v_take := LEAST(v_remaining, v_amount_needed);

    IF v_take > 0 THEN
      UPDATE public.credit_buckets
      SET remaining_amount = remaining_amount - v_take
      WHERE id = v_bucket_id;

      v_amount_needed := v_amount_needed - v_take;
      v_reserved_total := v_reserved_total + v_take;

      -- Record ledger entry per bucket deduction
      INSERT INTO public.credit_ledger (
        workspace_id, bucket_id, entry_type, amount, direction, reservation_id, job_id, idempotency_key, metadata
      ) VALUES (
        p_workspace_id, v_bucket_id, 'reserve'::ledger_entry_type, -v_take, -1,
        v_reservation_id, p_job_id,
        p_idempotency_key || ':bucket:' || v_bucket_id::text,
        jsonb_build_object('from_bucket', v_bucket_id, 'take', v_take)
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END LOOP;

  -- Defensive check: all credits must have been resolvable from buckets
  IF v_amount_needed > 0 THEN
    RAISE EXCEPTION 'Credit accounting error: could not reserve full amount from buckets (shortfall=%)', v_amount_needed;
  END IF;

  -- Update credit_accounts: available -> reserved
  UPDATE public.credit_accounts
  SET available = available - p_amount,
      reserved = reserved + p_amount,
      updated_at = NOW()
  WHERE workspace_id = p_workspace_id;

  RETURN v_reservation_id;
END;
$$;

-- ==========================================
-- 3. SETTLE_CREDITS
-- ==========================================
-- Converts a pending reservation into a consumed credit.
-- Adjusts bucket remaining_amount and credit_accounts.
CREATE OR REPLACE FUNCTION public.settle_credits(
  p_reservation_id UUID,
  p_actual_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_reserved_amount INTEGER;
  v_status reservation_status;
  v_difference INTEGER;
BEGIN
  -- Validate actual_amount
  IF p_actual_amount < 0 THEN
    RAISE EXCEPTION 'Actual amount cannot be negative';
  END IF;

  -- Lock and fetch the reservation
  SELECT workspace_id, reserved_amount, status
  INTO v_workspace_id, v_reserved_amount, v_status
  FROM public.credit_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  IF v_status != 'pending'::reservation_status THEN
    RAISE EXCEPTION 'Reservation already settled or released (status=%)', v_status;
  END IF;

  -- Lock credit_accounts
  PERFORM 1 FROM public.credit_accounts
  WHERE workspace_id = v_workspace_id
  FOR UPDATE;

  -- Mark reservation as settled
  UPDATE public.credit_reservations
  SET status = 'confirmed'::reservation_status,
      settled_amount = p_actual_amount
  WHERE id = p_reservation_id;

  -- Adjust credit_accounts: reserved -> consumed
  -- If actual was less than reserved, return excess to available
  v_difference := v_reserved_amount - p_actual_amount;

  UPDATE public.credit_accounts
  SET reserved = reserved - v_reserved_amount,
      consumed = consumed + p_actual_amount,
      available = available + v_difference,
      updated_at = NOW()
  WHERE workspace_id = v_workspace_id;

  -- Record ledger entry for the actual consumption
  INSERT INTO public.credit_ledger (
    workspace_id, bucket_id, entry_type, amount, direction, reservation_id, idempotency_key, metadata
  ) VALUES (
    v_workspace_id, NULL, 'consume'::ledger_entry_type, -p_actual_amount, -1,
    p_reservation_id, 'settle:' || p_reservation_id::text,
    jsonb_build_object('reserved_amount', v_reserved_amount, 'actual_amount', p_actual_amount)
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

-- ==========================================
-- 4. RELEASE_CREDITS
-- ==========================================
-- Releases a pending reservation, returning credits to available.
-- Used when an operation fails or is cancelled.
CREATE OR REPLACE FUNCTION public.release_credits(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_reserved_amount INTEGER;
  v_status reservation_status;
BEGIN
  -- Lock and fetch the reservation
  SELECT workspace_id, reserved_amount, status
  INTO v_workspace_id, v_reserved_amount, v_status
  FROM public.credit_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  IF v_status != 'pending'::reservation_status THEN
    RAISE EXCEPTION 'Reservation already settled or released (status=%)', v_status;
  END IF;

  -- Lock credit_accounts
  PERFORM 1 FROM public.credit_accounts
  WHERE workspace_id = v_workspace_id
  FOR UPDATE;

  -- Mark reservation as released
  UPDATE public.credit_reservations
  SET status = 'released'::reservation_status
  WHERE id = p_reservation_id;

  -- Return credits to available
  UPDATE public.credit_accounts
  SET reserved = reserved - v_reserved_amount,
      available = available + v_reserved_amount,
      updated_at = NOW()
  WHERE workspace_id = v_workspace_id;

  -- Record ledger entry
  INSERT INTO public.credit_ledger (
    workspace_id, bucket_id, entry_type, amount, direction, reservation_id, idempotency_key
  ) VALUES (
    v_workspace_id, NULL, 'release'::ledger_entry_type, v_reserved_amount, 1,
    p_reservation_id, 'release:' || p_reservation_id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

-- ==========================================
-- 5. GRANT_CREDITS
-- ==========================================
-- Adds credits to a workspace from a specific source
-- (subscription renewal, purchase, promotion, manual).
-- Creates a new bucket and records the ledger entry.
CREATE OR REPLACE FUNCTION public.grant_credits(
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
DECLARE
  v_bucket_id UUID;
  v_valid_source TEXT;
  v_entry_type ledger_entry_type;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Grant amount must be positive';
  END IF;

  -- Validate source
  v_valid_source := CASE p_source
    WHEN 'subscription' THEN 'subscription'
    WHEN 'purchase' THEN 'purchase'
    WHEN 'promotion' THEN 'promotion'
    WHEN 'manual' THEN 'manual'
    ELSE NULL
  END;

  IF v_valid_source IS NULL THEN
    RAISE EXCEPTION 'Invalid source: % (must be subscription, purchase, promotion, or manual)', p_source;
  END IF;

  -- Map to ledger entry type
  v_entry_type := CASE p_source
    WHEN 'subscription' THEN 'grant_plan'::ledger_entry_type
    WHEN 'purchase' THEN 'grant_purchase'::ledger_entry_type
    WHEN 'promotion' THEN 'grant_promotion'::ledger_entry_type
    WHEN 'manual' THEN 'manual_adjustment'::ledger_entry_type
  END;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_bucket_id
    FROM public.credit_buckets
    WHERE workspace_id = p_workspace_id
      AND metadata->>'idempotency_key' = p_idempotency_key
    LIMIT 1;

    IF v_bucket_id IS NOT NULL THEN
      RETURN v_bucket_id;
    END IF;
  END IF;

  -- Lock credit_accounts
  PERFORM 1 FROM public.credit_accounts
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;

  -- Create the bucket
  INSERT INTO public.credit_buckets (
    workspace_id, source_type, original_amount, remaining_amount, expires_at, priority, metadata
  ) VALUES (
    p_workspace_id, v_valid_source, p_amount, p_amount, p_expires_at, p_priority,
    CASE WHEN p_idempotency_key IS NOT NULL
      THEN jsonb_build_object('idempotency_key', p_idempotency_key)
      ELSE '{}'::jsonb
    END
  )
  RETURNING id INTO v_bucket_id;

  -- Update credit_accounts — only add to available if bucket is not already expired
  IF p_expires_at IS NULL OR p_expires_at > NOW() THEN
    UPDATE public.credit_accounts
    SET available = available + p_amount,
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id;
  END IF;

  -- Record ledger entry
  INSERT INTO public.credit_ledger (
    workspace_id, bucket_id, entry_type, amount, direction, idempotency_key, metadata
  ) VALUES (
    p_workspace_id, v_bucket_id, v_entry_type,
    p_amount, 1, p_idempotency_key,
    jsonb_build_object('source', p_source, 'expires_at', p_expires_at)
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN v_bucket_id;
END;
$$;

-- ==========================================
-- 6. GET_WORKSPACE_BALANCE
-- ==========================================
-- Returns the current credit balance for verification.
-- Pure read, no locking.
CREATE OR REPLACE FUNCTION public.get_workspace_balance(p_workspace_id UUID)
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
  SELECT
    ca.available::INTEGER,
    ca.reserved::INTEGER,
    ca.consumed::INTEGER,
    ca.expired::INTEGER,
    (SELECT COUNT(*)::INTEGER
     FROM public.credit_buckets cb
     WHERE cb.workspace_id = p_workspace_id
       AND cb.remaining_amount > 0
       AND (cb.expires_at IS NULL OR cb.expires_at > NOW())
    )::INTEGER
  FROM public.credit_accounts ca
  WHERE ca.workspace_id = p_workspace_id;
END;
$$;

-- ==========================================
-- 7. CLEANUP_EXPIRED_RESERVATIONS
-- ==========================================
-- Releases reservations that have expired (TTL passed).
-- Can be called by a cron job or before any reserve.
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_record IN
    SELECT id FROM public.credit_reservations
    WHERE status = 'pending'::reservation_status
      AND expires_at < NOW()
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.release_credits(v_record.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ==========================================
-- 8. GRANTS
-- ==========================================
-- Grant execute only to service_role (Edge Functions).
-- Authenticated users cannot call these directly.

GRANT EXECUTE ON FUNCTION public.reserve_credits(UUID, INTEGER, TEXT, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_credits(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_credits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_workspace_credits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reservations() TO service_role;
