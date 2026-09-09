-- Migration: pgvector + embedding infrastructure
-- Depends on: 20240722000002_document_chunks.sql

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Add embedding columns to document_chunks
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_provider TEXT,
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_version TEXT,
  ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 3. HNSW index for vector similarity search
-- Created without data — will be populated as embeddings are generated
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
  ON document_chunks
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- 4. Index for cache lookup by content hash
CREATE INDEX IF NOT EXISTS idx_chunks_content_hash
  ON document_chunks (content_hash)
  WHERE embedding IS NOT NULL;

-- 5. Embedding cache table (cross-document, reconstructable)
CREATE TABLE IF NOT EXISTS embedding_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  model_version TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  embedding extensions.vector(1536) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  use_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_embedding_cache_hash
  ON embedding_cache (content_hash);

-- RLS for embedding_cache
ALTER TABLE embedding_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "embedding_cache_service_role_policy"
  ON embedding_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "embedding_cache_authenticated_read"
  ON embedding_cache FOR SELECT
  TO authenticated
  USING (true);

-- 6. Embedding jobs table (event-driven, distributed execution)
CREATE TABLE IF NOT EXISTS embedding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_chunks INTEGER NOT NULL DEFAULT 0,
  embedded_chunks INTEGER NOT NULL DEFAULT 0,
  failed_chunks INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  model TEXT,
  total_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  error_message TEXT,
  -- Distributed execution fields
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for finding ready jobs (simplified — no now() in predicate)
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_ready
  ON embedding_jobs (created_at)
  WHERE status = 'pending'
    AND locked_by IS NULL;

-- Index for document lookup
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_document
  ON embedding_jobs (document_id);

-- RLS for embedding_jobs
ALTER TABLE embedding_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "embedding_jobs_select_policy"
  ON embedding_jobs FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "embedding_jobs_insert_policy"
  ON embedding_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "embedding_jobs_service_role_policy"
  ON embedding_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. RPC for claiming a job (atomic, supports distributed execution)
CREATE OR REPLACE FUNCTION claim_embedding_job(p_worker_id TEXT)
RETURNS SETOF embedding_jobs
LANGUAGE sql AS $$
  UPDATE embedding_jobs
  SET status = 'processing',
      locked_by = p_worker_id,
      locked_at = now(),
      started_at = COALESCE(started_at, now()),
      attempt = attempt + 1
  WHERE id = (
    SELECT id FROM embedding_jobs
    WHERE status = 'pending'
      AND (next_retry_at IS NULL OR next_retry_at <= now())
      AND (locked_by IS NULL OR locked_at < now() - INTERVAL '5 minutes')
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
