-- Phase 14: Real Document Processing Pipeline

-- 1. Add caching (file hash) to documents
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Index to quickly find existing documents by hash
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON public.documents(file_hash);

-- 2. Enhance processing_jobs
-- We will use 'error_details' as the error_message for backward compatibility or rename it
ALTER TABLE public.processing_jobs RENAME COLUMN error_details TO error_message;

-- Add new columns for tracking
ALTER TABLE public.processing_jobs
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_time INTEGER,
ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

-- 3. Add 'processing' to job_status enum if not exists
-- Postgres doesn't have CREATE TYPE IF NOT EXISTS for enum values easily, so we use a PL/pgSQL block
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'job_status' AND e.enumlabel = 'processing') THEN
    ALTER TYPE job_status ADD VALUE 'processing';
  END IF;
END $$;

-- 4. Setup Database Webhook for processing orchestration
-- This trigger will call the Edge Function when a new job is queued.
-- Supabase Edge Functions webhook setup:
-- We'll use the HTTP extension if available, or just a dummy function that developers can wire to Edge Functions in production.
-- For local dev/standard SaaS, we create a function that uses pg_net (if enabled) to call the webhook.

-- First, ensure pg_net is enabled (Supabase specific)
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION trigger_processing_job_webhook()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'queued' AND (OLD IS NULL OR OLD.status != 'queued') THEN
    -- Make a POST request to the Edge Function URL.
    -- In production, the URL should be configured via an environment variable or secret, 
    -- but here we assume a local or standard convention. 
    -- Note: We'll wrap this in a safe block in case pg_net isn't configured, so it doesn't break inserts.
    BEGIN
      PERFORM net.http_post(
        url := current_setting('app.edge_function_url', true) || '/process-document',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.edge_function_anon_key', true) || '"}',
        body := json_build_object('record', row_to_json(NEW))::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      -- Silently ignore if pg_net fails locally so it doesn't break the app
      RAISE WARNING 'Failed to trigger processing webhook: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS processing_job_queued_trigger ON public.processing_jobs;
CREATE TRIGGER processing_job_queued_trigger
AFTER INSERT OR UPDATE ON public.processing_jobs
FOR EACH ROW
EXECUTE FUNCTION trigger_processing_job_webhook();
