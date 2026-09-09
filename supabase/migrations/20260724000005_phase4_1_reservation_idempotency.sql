-- ============================================================
-- Phase 4.1: Add idempotency_key to credit_reservations
-- ============================================================
-- The Phase 4 RPCs require credit_reservations to have an
-- idempotency_key column for the idempotency check pattern.
-- This migration adds it.

ALTER TABLE public.credit_reservations
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_reservations_idempotency_key
  ON public.credit_reservations (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
