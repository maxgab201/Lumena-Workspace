-- Migration: Add atomic credit account increment RPC
-- This is needed for the Stripe webhook to atomically increment credit balances

-- Function to atomically increment credit_accounts.available
-- Uses UPDATE ... RETURNING to avoid race conditions
CREATE OR REPLACE FUNCTION public.increment_credit_account(
  p_workspace_id UUID,
  p_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atomically increment the available credits
  -- Using a single UPDATE statement ensures atomicity
  UPDATE public.credit_accounts
  SET
    available = available + p_amount,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id;

  -- If no row was updated, the workspace might not have a credit_account yet
  -- This shouldn't happen in normal operation (trigger creates it on workspace creation)
  -- but we handle it gracefully
  IF NOT FOUND THEN
    INSERT INTO public.credit_accounts (workspace_id, available, reserved, consumed, expired)
    VALUES (p_workspace_id, p_amount, 0, 0, 0);
  END IF;
END;
$$;

-- Grant execute permission to service_role (Edge Functions use this)
GRANT EXECUTE ON FUNCTION public.increment_credit_account(UUID, INTEGER) TO service_role;