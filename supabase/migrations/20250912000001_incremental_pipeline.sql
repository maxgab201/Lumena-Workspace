-- ============================================================
-- Checkpoint 3b: incremental pipeline for large documents
-- ============================================================
-- Fixes the "big PDF processes forever" bug. Root cause found by
-- reproduction: when the Edge Function is killed by the runtime
-- (CPU/memory limits during sequential embedding of hundreds of
-- chunks), the catch block never runs and the job stays 'processing'
-- forever — observed jobs stuck for 19 and 53 days. There was no
-- watchdog and no progress checkpointing.
--
-- Design:
--   • processing_jobs.progress_heartbeat: every real stage update
--     touches it. A watchdog reaps jobs whose heartbeat is stale
--     (runtime died mid-flight) and marks them failed-with-retryable
--     instead of leaving an eternal spinner.
--   • documents.text_status: replaces the single extracted_text blob
--     semantics with a per-document stage the UI can surface:
--     pending → complete | partial (some pages empty) | failed.
--     Core reading is ready regardless of these AI-side stages.
-- ============================================================

-- 1. Heartbeat for processing jobs
ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS progress_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Fine-grained text layer status on documents (core stays independent)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS text_status TEXT DEFAULT 'pending'
  CHECK (text_status IN ('pending', 'processing', 'complete', 'partial', 'failed'));

-- 3. Per-page text checkpoint: extraction of large PDFs is incremental and
-- resumable. Each extracted batch is upserted here; a retry skips pages that
-- already exist (real resume, not a full re-process).
CREATE TABLE IF NOT EXISTS public.document_page_texts (
  document_id  UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  page_number  INTEGER     NOT NULL CHECK (page_number >= 1),
  page_text    TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, page_number)
);

ALTER TABLE public.document_page_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view page texts in their workspaces"
  ON public.document_page_texts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_page_texts.document_id
        AND d.workspace_id IN (SELECT public.get_user_workspace_ids())
    )
  );

CREATE POLICY "Service role manages page texts"
  ON public.document_page_texts FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Backfill: ready documents already have their text
UPDATE public.documents
SET text_status = CASE
  WHEN extracted_text IS NOT NULL AND LENGTH(extracted_text) > 0 THEN 'complete'
  ELSE 'pending'
END
WHERE text_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_processing_jobs_stale
  ON public.processing_jobs (status, progress_heartbeat);

-- ============================================================
-- WATCHDOG: reap dead jobs
-- ============================================================
-- A job is dead when it claims to be active but its heartbeat is
-- older than STALE_MINUTES (Edge Function CPU/kill loses in-flight
-- state; nothing will ever touch the row again). The watchdog marks
-- it failed with an actionable message so the UI offers Retry
-- instead of an eternal spinner. Safe to call repeatedly.
CREATE OR REPLACE FUNCTION public.reap_stale_processing_jobs(
  stale_minutes INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reaped INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT pj.id, pj.document_id
    FROM public.processing_jobs pj
    WHERE pj.status IN ('queued', 'inspecting', 'extracting', 'processing', 'retrying')
      AND pj.progress_heartbeat < NOW() - make_interval(mins => stale_minutes)
  LOOP
    UPDATE public.processing_jobs
    SET status = 'failed',
        error_message = 'Processing interrupted (service restarted or timed out). Retry to resume — completed pages are kept.',
        updated_at = NOW()
    WHERE id = r.id;

    UPDATE public.documents
    SET status = CASE WHEN status = 'ready' THEN 'ready' ELSE 'error' END,
        updated_at = NOW()
    WHERE id = r.document_id;

    reaped := reaped + 1;
  END LOOP;
  RETURN reaped;
END;
$$;

-- ============================================================
-- CRON-STYLE SWEEP via pg_cron if available; otherwise the app's
-- status polling calls the RPC opportunistically (cheap, indexed).
-- ============================================================
