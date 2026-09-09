-- ==========================================
-- ATOMIC CREDIT OPERATIONS
-- Provides race-condition-free credit reservation and consumption
-- ==========================================

-- Atomic credit reservation
-- Returns the reservation_id on success, NULL on insufficient credits
CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_workspace_id UUID,
  p_amount INTEGER,
  p_job_id UUID DEFAULT NULL,
  p_requested_amount INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id UUID;
  v_new_available INTEGER;
  v_new_reserved INTEGER;
BEGIN
  -- Atomic update with check: only proceed if available >= amount
  UPDATE public.credit_accounts
  SET
    available = available - p_amount,
    reserved = reserved + p_amount,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id
    AND available >= p_amount
  RETURNING available, reserved INTO v_new_available, v_new_reserved;

  IF NOT FOUND THEN
    RETURN NULL; -- Insufficient credits
  END IF;

  -- Create reservation record
  INSERT INTO public.credit_reservations (
    workspace_id,
    job_id,
    requested_amount,
    reserved_amount,
    status
  ) VALUES (
    p_workspace_id,
    p_job_id,
    COALESCE(p_requested_amount, p_amount),
    p_amount,
    'pending'
  ) RETURNING id INTO v_reservation_id;

  -- Write to ledger
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

-- Atomic credit settlement (consume actual cost, release reservation)
-- Returns TRUE on success, FALSE if reservation not found or not pending
CREATE OR REPLACE FUNCTION public.settle_credits(
  p_workspace_id UUID,
  p_reservation_id UUID,
  p_actual_cost INTEGER,
  p_job_id UUID DEFAULT NULL
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
  -- Get reservation details and validate
  SELECT reserved_amount, status
  INTO v_reserved_amount, v_status
  FROM public.credit_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_status != 'pending' THEN
    RETURN FALSE; -- Already settled or cancelled
  END IF;

  -- Atomic update: release reservation difference, add actual consumption
  -- available = available + (reserved - actual)
  -- reserved = reserved - reserved_amount
  -- consumed = consumed + actual_cost
  UPDATE public.credit_accounts
  SET
    available = available + (v_reserved_amount - p_actual_cost),
    reserved = reserved - v_reserved_amount,
    consumed = consumed + p_actual_cost,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update reservation status
  UPDATE public.credit_reservations
  SET
    status = 'confirmed',
    settled_amount = p_actual_cost
  WHERE id = p_reservation_id;

  -- Write consume entry to ledger
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

-- Atomic credit release (cancel reservation without consumption)
-- Returns TRUE on success, FALSE if reservation not found or not pending
CREATE OR REPLACE FUNCTION public.release_credits(
  p_workspace_id UUID,
  p_reservation_id UUID,
  p_job_id UUID DEFAULT NULL
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
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_status != 'pending' THEN
    RETURN FALSE;
  END IF;

  -- Atomic update: return reserved credits to available
  UPDATE public.credit_accounts
  SET
    available = available + v_reserved_amount,
    reserved = reserved - v_reserved_amount,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id;

  -- Update reservation status
  UPDATE public.credit_reservations
  SET status = 'released'
  WHERE id = p_reservation_id;

  -- Write release entry to ledger
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
    1, -- positive direction (credits returned)
    p_reservation_id,
    p_job_id
  );

  RETURN TRUE;
END;
$$;

-- Atomic credit grant (for plan renewals, promotions, purchases)
-- Returns the new available balance
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_workspace_id UUID,
  p_amount INTEGER,
  p_entry_type TEXT DEFAULT 'grant_purchase',
  p_source_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_available INTEGER;
  v_new_consumed INTEGER;
BEGIN
  -- Atomic update: add to available
  UPDATE public.credit_accounts
  SET
    available = available + p_amount,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id
  RETURNING available INTO v_new_available;

  IF NOT FOUND THEN
    -- Account doesn't exist, create it
    INSERT INTO public.credit_accounts (workspace_id, available, reserved, consumed, expired)
    VALUES (p_workspace_id, p_amount, 0, 0, 0)
    RETURNING available INTO v_new_available;
  END IF;

  -- Write to ledger
  INSERT INTO public.credit_ledger (
    workspace_id,
    entry_type,
    amount,
    direction,
    idempotency_key
  ) VALUES (
    p_workspace_id,
    p_entry_type,
    p_amount,
    1,
    p_source_id::TEXT
  );

  RETURN v_new_available;
END;
$$;

-- Monthly credit grant for subscription plans
-- Called by pg_cron or similar scheduler
CREATE OR REPLACE FUNCTION public.grant_monthly_plan_credits()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
BEGIN
  FOR v_sub IN
    SELECT s.workspace_id, p.code as plan_code
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE s.status = 'active'
      AND p.code != 'free'
  LOOP
    -- Grant monthly credits based on plan
    PERFORM public.grant_credits(
      v_sub.workspace_id,
      CASE v_sub.plan_code
        WHEN 'go' THEN 200
        WHEN 'pro' THEN 1000
        WHEN 'max' THEN 5000
        ELSE 0
      END,
      'grant_plan',
      v_sub.workspace_id
    );
  END LOOP;
END;
$$;

-- Expire old reservations (called by pg_cron)
CREATE OR REPLACE FUNCTION public.expire_old_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT id, workspace_id, reserved_amount
    FROM public.credit_reservations
    WHERE status = 'pending'
      AND expires_at < NOW()
  LOOP
    PERFORM public.release_credits(v_rec.workspace_id, v_rec.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Grant execute permissions to service_role
-- Note: no consume_credits grant — this migration does not define that function.
-- release_credits here takes (workspace_id, reservation_id, job_id DEFAULT NULL),
-- so the 2-arg form is matched by the (UUID, UUID) signature.
GRANT EXECUTE ON FUNCTION public.reserve_credits(UUID, INTEGER, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_credits(UUID, UUID, INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_credits(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_monthly_plan_credits() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_old_reservations() TO service_role;