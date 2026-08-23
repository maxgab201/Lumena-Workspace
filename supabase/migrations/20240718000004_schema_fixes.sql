-- ============================================================
-- Schema Fixes and Enhancements
-- ============================================================
-- This migration corrects omissions from the initial schema:
--   1. documents table: add mime_type, page_count columns
--   2. documents table: composite index for workspace+status filtering
--   3. user_settings: persist view_mode and sort preferences
--   4. subscriptions: add INSERT policy (needed for backfill trigger)
--   5. Add updated_at auto-update triggers where missing
-- ============================================================

-- 1. Enhance documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS mime_type  TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER;

-- 2. Composite index for dashboard filtering (workspace + status)
CREATE INDEX IF NOT EXISTS idx_documents_workspace_status
  ON public.documents(workspace_id, status);

-- 3. Extend user_settings with view preferences
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS view_mode   TEXT NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS sort_by     TEXT NOT NULL DEFAULT 'date',
  ADD COLUMN IF NOT EXISTS sort_order  TEXT NOT NULL DEFAULT 'desc';

-- 4. Subscriptions INSERT policy (required for the signup trigger)
CREATE POLICY IF NOT EXISTS "System can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK ( true );

-- 5. Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables that have updated_at but no trigger yet
CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_flashcards_updated_at
  BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_glossary_terms_updated_at
  BEFORE UPDATE ON public.glossary_terms
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_highlights_updated_at
  BEFORE UPDATE ON public.highlights
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
