-- Migration: Atomic Credit Reservation & Consumption RPCs
-- Provides race-condition-free credit operations for Edge Functions

-- ==========================================
-- ATOMIC CREDIT RESERVATION
-- ==========================================
-- Reserves credits atomically: checks available >= amount, then decrements available and increments reserved
-- Returns the reservation_id if successful, NULL if insufficient credits

CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_workspace_id UUID,
  p_amount INTEGER,
  p_job_id UUID,
  p_requested_amount INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id UUID;
BEGIN
  -- Atomic reservation: only proceed if available >= amount
  -- Uses UPDATE with WHERE clause for atomic check-and-update
  UPDATE public.credit_accounts
  SET
    available = available - p_amount,
    reserved = reserved + p_amount,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id
    AND available >= p_amount;

  IF NOT FOUND THEN
    RETURN NULL; -- Insufficient credits
  END IF;

  -- Create reservation record
  INSERT INTO public.credit_reservations (
    workspace_id,
    job_id,
    requested_amount,
    reserved_amount,
    expires_at,
    status
  ) VALUES (
    p_workspace_id,
    p_job_id,
    p_requested_amount,
    p_amount,
    NOW() + INTERVAL '1 hour',
    'pending'
  ) RETURNING id INTO v_reservation_id;

  -- Ledger entry for reservation
  INSERT INTO public.credit_ledger (
    workspace_id,
    entry_type,
    amount,
    direction,
    reservation_id,
    job_id
  ) VALUES (
    p_workspace_id,
    'reserve',
    p_amount,
    -1,
    v_reservation_id,
    p_job_id
  );

  RETURN v_reservation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_credits(UUID, INTEGER, UUID, INTEGER) TO service_role;


-- ==========================================
-- ATOMIC CREDIT CONSUMPTION (SETTLEMENT)
-- ==========================================
-- Settles a reservation: releases reserved amount, deducts actual cost from available
-- Returns TRUE if successful, FALSE if reservation not found or already settled

CREATE OR REPLACE FUNCTION public.settle_credits(
  p_workspace_id UUID,
  p_reservation_id UUID,
  p_actual_cost INTEGER,
  p_job_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved_amount INTEGER;
  v_status TEXT;
BEGIN
  -- Get reservation details
  SELECT reserved_amount, status
  INTO v_reserved_amount, v_status
  FROM public.credit_reservations
  WHERE id = p_reservation_id
    AND workspace_id = p_workspace_id
    AND job_id = p_job_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_status != 'pending' THEN
    RETURN FALSE; -- Already settled or cancelled
  END IF;

  -- Atomic settlement: release full reservation, deduct actual cost
  -- available = available + reserved_amount - actual_cost
  -- reserved = reserved - reserved_amount
  -- consumed = consumed + actual_cost
  UPDATE public.credit_accounts
  SET
    available = available + v_reserved_amount - p_actual_cost,
    reserved = reserved - v_reserved_amount,
    consumed = consumed + p_actual_cost,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id;

  -- Mark reservation as confirmed
  UPDATE public.credit_reservations
  SET
    status = 'confirmed',
    settled_amount = p_actual_cost
  WHERE id = p_reservation_id;

  -- Ledger entry for consumption
  INSERT INTO public.credit_ledger (
    workspace_id,
    entry_type,
    amount,
    direction,
    reservation_id,
    job_id
  ) VALUES (
    p_workspace_id,
    'consume',
    p_actual_cost,
    -1,
    p_reservation_id,
    p_job_id
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_credits(UUID, UUID, INTEGER, UUID) TO service_role;


-- ==========================================
-- CREDIT RELEASE (FOR FAILED JOBS)
-- ==========================================
-- Releases a reservation without consumption (failed/cancelled job)
-- Returns TRUE if successful

CREATE OR REPLACE FUNCTION public.release_credits(
  p_workspace_id UUID,
  p_reservation_id UUID,
  p_job_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved_amount INTEGER;
  v_status TEXT;
BEGIN
  SELECT reserved_amount, status
  INTO v_reserved_amount, v_status
  FROM public.credit_reservations
  WHERE id = p_reservation_id
    AND workspace_id = p_workspace_id
    AND job_id = p_job_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_status != 'pending' THEN
    RETURN FALSE;
  END IF;

  -- Atomic release: move from reserved back to available
  UPDATE public.credit_accounts
  SET
    available = available + v_reserved_amount,
    reserved = reserved - v_reserved_amount,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id;

  UPDATE public.credit_reservations
  SET status = 'released'
  WHERE id = p_reservation_id;

  -- Ledger entry for release
  INSERT INTO public.credit_ledger (
    workspace_id,
    entry_type,
    amount,
    direction,
    reservation_id,
    job_id
  ) VALUES (
    p_workspace_id,
    'release',
    v_reserved_amount,
    1, -- positive: credits returned
    p_reservation_id,
    p_job_id
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_credits(UUID, UUID, UUID) TO service_role;