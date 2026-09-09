-- ==========================================
-- MIGRATION: RAG search functions (complement to 20240730000001_rag_embeddings_infrastructure.sql)
-- ==========================================
-- The infrastructure migration owns document_embeddings, document_chunks,
-- embedding_models, search_queries and the hybrid/semantic/keyword_search RPCs
-- used by the rag-retrieve Edge Function.
--
-- This migration only adds the standalone search RPCs kept from the earlier
-- draft (document-level keyword search) plus full-text search support on
-- documents.extracted_text. All statements are idempotent.

-- Document RAG columns (extraction + embedding tracking)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS text_extracted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS embedding_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_documents_embedding_status'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT check_documents_embedding_status
      CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed'));
  END IF;
END $$;

-- SRS (SM-2) persistence for flashcards
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS ease_factor REAL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS repetitions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interval_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_grade INTEGER;

-- pg_net webhook settings for processing pipeline (set via supabase secrets/dashboard)
-- app.edge_function_url and app.edge_function_anon_key are read by the
-- trigger_processing_job_webhook trigger created in 20240718000005.
CREATE OR REPLACE FUNCTION public.ensure_edge_function_settings()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    IF current_setting('app.edge_function_url', true) IS NULL THEN
      PERFORM set_config('app.edge_function_url', '', false);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

-- Full-text search index on extracted text
CREATE INDEX IF NOT EXISTS idx_documents_extracted_text_fts
  ON public.documents USING GIN (to_tsvector('english', extracted_text))
  WHERE extracted_text IS NOT NULL;

-- Index for embedding status queries
CREATE INDEX IF NOT EXISTS idx_documents_embedding_status
  ON public.documents (embedding_status)
  WHERE embedding_status IN ('pending', 'processing');

-- Keyword-only document search (PostgreSQL full-text search over whole documents)
CREATE OR REPLACE FUNCTION public.search_documents_keyword(
  p_workspace_id UUID,
  p_query_text TEXT,
  p_limit INTEGER DEFAULT 10,
  p_document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  document_id UUID,
  document_name TEXT,
  rank FLOAT,
  snippet TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS document_id,
    d.name AS document_name,
    ts_rank_cd(to_tsvector('english', d.extracted_text), plainto_tsquery('english', p_query_text)) AS rank,
    ts_headline('english', d.extracted_text, plainto_tsquery('english', p_query_text)) AS snippet
  FROM public.documents d
  WHERE d.workspace_id = p_workspace_id
    AND d.extracted_text IS NOT NULL
    AND (p_document_ids IS NULL OR d.id = ANY(p_document_ids))
    AND to_tsvector('english', d.extracted_text) @@ plainto_tsquery('english', p_query_text)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_documents_keyword TO service_role;
GRANT EXECUTE ON FUNCTION public.search_documents_keyword TO authenticated;
