-- ==========================================
-- MIGRATION: Fix processing job webhook trigger
-- ==========================================
-- The original trigger read app.edge_function_url / app.edge_function_anon_key
-- via current_setting(), which requires superuser to persist at database level
-- on hosted Supabase. This version hardcodes the project's public Functions URL
-- (not a secret) and uses the anon key stored in vault-like config table.
-- The trigger is best-effort: failures never block job inserts.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store the anon key in a service-role-readable table (RLS denies all to non-service roles)
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE private.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage app config" ON private.app_config;
CREATE POLICY "Service role can manage app config" ON private.app_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO private.app_config (key, value) VALUES ('edge_function_anon_key', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trigger_processing_job_webhook()
RETURNS TRIGGER AS $$
DECLARE
  v_anon_key TEXT;
BEGIN
  IF NEW.status = 'queued' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'queued') THEN
    BEGIN
      SELECT value INTO v_anon_key FROM private.app_config WHERE key = 'edge_function_anon_key';

      PERFORM net.http_post(
        url := 'https://nsjetmjtwbhellqasggw.supabase.co/functions/v1/process-document',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
        ),
        body := jsonb_build_object('record', to_jsonb(NEW))
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to trigger processing webhook: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, private;

DROP TRIGGER IF EXISTS processing_job_queued_trigger ON public.processing_jobs;
CREATE TRIGGER processing_job_queued_trigger
AFTER INSERT OR UPDATE OF status ON public.processing_jobs
FOR EACH ROW
EXECUTE FUNCTION public.trigger_processing_job_webhook();
