-- Migration: Create document_chunks table for text chunking
-- Supports full-text search via tsvector (pgvector deferred to Issue #18)

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id TEXT PRIMARY KEY,                           -- e.g. 'doc-id_p0_c0'
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  start_offset INTEGER NOT NULL DEFAULT 0,
  end_offset INTEGER NOT NULL DEFAULT 0,
  chunk_type TEXT NOT NULL DEFAULT 'paragraph',  -- paragraph, section, table, figure
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', content)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for full-text search
CREATE INDEX IF NOT EXISTS idx_document_chunks_search
  ON document_chunks USING GIN (search_vector);

-- Index for document lookups
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
  ON document_chunks (document_id);

-- Unique constraint: one chunk per (document, page, chunk index)
-- The id already encodes this, but this prevents duplicates at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_chunks_unique
  ON document_chunks (document_id, page_number, id);

-- RLS policies
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_chunks_select_policy"
  ON document_chunks FOR SELECT
  TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN workspace_members wm ON wm.workspace_id = d.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "document_chunks_insert_policy"
  ON document_chunks FOR INSERT
  TO authenticated
  WITH CHECK (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN workspace_members wm ON wm.workspace_id = d.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "document_chunks_service_role_policy"
  ON document_chunks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
