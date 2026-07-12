-- Create job status enum
CREATE TYPE job_status AS ENUM (
  'queued', 
  'inspecting', 
  'extracting', 
  'ocr', 
  'layout', 
  'completed', 
  'failed', 
  'retrying', 
  'cancelled', 
  'paused'
);

-- Create processing_jobs table
CREATE TABLE public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  status job_status NOT NULL DEFAULT 'queued',
  progress FLOAT NOT NULL DEFAULT 0.0,
  error_details TEXT,
  provider_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create processing_events table
CREATE TABLE public.processing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.processing_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create processing_logs table
CREATE TABLE public.processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.processing_jobs(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_processing_jobs_workspace_id ON public.processing_jobs(workspace_id);
CREATE INDEX idx_processing_jobs_document_id ON public.processing_jobs(document_id);
CREATE INDEX idx_processing_events_job_id ON public.processing_events(job_id);
CREATE INDEX idx_processing_logs_job_id ON public.processing_logs(job_id);

-- Enable RLS
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_logs ENABLE ROW LEVEL SECURITY;

-- Policies for processing_jobs
CREATE POLICY "Users can view jobs in their workspaces"
  ON public.processing_jobs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert jobs into their workspaces"
  ON public.processing_jobs FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update jobs in their workspaces"
  ON public.processing_jobs FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete jobs in their workspaces"
  ON public.processing_jobs FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Policies for processing_events
CREATE POLICY "Users can view events in their workspaces"
  ON public.processing_events FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM public.processing_jobs WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert events into their workspaces"
  ON public.processing_events FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM public.processing_jobs WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Policies for processing_logs
CREATE POLICY "Users can view logs in their workspaces"
  ON public.processing_logs FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM public.processing_jobs WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert logs into their workspaces"
  ON public.processing_logs FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM public.processing_jobs WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    )
  );
