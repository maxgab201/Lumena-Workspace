-- ==========================================
-- MIGRATION: RAG/Embeddings Infrastructure
-- ==========================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ==========================================
-- 1. EMBEDDINGS TABLE
-- ==========================================
-- Stores document chunks with their vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,           -- Order of chunk within document
  chunk_text TEXT NOT NULL,               -- Text content of this chunk
  chunk_tokens INTEGER NOT NULL,          -- Token count for this chunk
  embedding extensions.vector(768) NOT NULL,         -- Vector embedding (Gemini embedding-001 = 768 dims)
  metadata JSONB DEFAULT '{}',            -- Additional metadata (page_number, chunk_type, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique chunk per document
  UNIQUE(document_id, chunk_index)
);

-- RLS for document_embeddings
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace embeddings" ON public.document_embeddings
  FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Users can insert their workspace embeddings" ON public.document_embeddings
  FOR INSERT WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Users can update their workspace embeddings" ON public.document_embeddings
  FOR UPDATE USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Users can delete their workspace embeddings" ON public.document_embeddings
  FOR DELETE USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- Indexes for document_embeddings
CREATE INDEX IF NOT EXISTS idx_document_embeddings_workspace_doc
  ON public.document_embeddings (workspace_id, document_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_chunk
  ON public.document_embeddings (document_id, chunk_index);

-- Vector similarity search index (HNSW for performance)
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector
  ON public.document_embeddings USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ==========================================
-- 2. EMBEDDING MODELS TRACKING
-- ==========================================
-- Track which embedding model was used for each embedding
CREATE TABLE IF NOT EXISTS public.embedding_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,              -- e.g., 'gemini-embedding-001', 'text-embedding-3-small'
  provider TEXT NOT NULL,                  -- 'google', 'openai', 'local'
  dimensions INTEGER NOT NULL,             -- Vector dimensions (768 for Gemini, 1536 for OpenAI)
  max_input_tokens INTEGER NOT NULL,       -- Max tokens per request
  cost_per_1k_tokens DECIMAL(10,6) DEFAULT 0, -- Cost per 1k tokens in USD
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default embedding models
INSERT INTO public.embedding_models (name, provider, dimensions, max_input_tokens, cost_per_1k_tokens, is_active)
VALUES
  ('gemini-embedding-001', 'google', 768, 2048, 0.00001, true),
  ('text-embedding-3-small', 'openai', 1536, 8191, 0.00002, false),
  ('text-embedding-3-large', 'openai', 3072, 8191, 0.00013, false)
ON CONFLICT (name) DO NOTHING;

-- RLS for embedding_models (read-only for users)
ALTER TABLE public.embedding_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view active embedding models" ON public.embedding_models
  FOR SELECT USING (is_active = true);

-- ==========================================
-- 3. DOCUMENT CHUNKS METADATA
-- ==========================================
-- NOTE: document_chunks already exists (created by 20240722000002 with an
-- id TEXT PK, page_number INTEGER, content, search_vector tsvector, and
-- embedding extensions.vector(1536) added by 20240723000001).
-- That schema is the source of truth. We only ensure RLS is enabled here.
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Ensure service_role has full access for Edge Functions (already granted by
-- 20240722000002 policies; kept idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_chunks' AND policyname = 'document_chunks_service_role_policy'
  ) THEN
    CREATE POLICY "document_chunks_service_role_policy"
      ON public.document_chunks FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add workspace_id to document_chunks for workspace-scoped search functions.
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.document_chunks dc
SET workspace_id = d.workspace_id
FROM public.documents d
WHERE dc.workspace_id IS NULL AND dc.document_id = d.id;

CREATE INDEX IF NOT EXISTS idx_document_chunks_workspace_doc
  ON public.document_chunks (workspace_id);

-- Align the embedding column type with the Gemini 768-dim embeddings used by
-- the pipeline (the existing column is vector(1536); alter if empty or recreate
-- as text-compatible). Only widen/replace when no rows conflict.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_chunks' AND column_name = 'embedding'
      AND udt_name = 'vector'
  ) THEN
    -- Existing vector(1536) column: keep it but allow 768-dim inserts by casting
    -- at write time in the Edge Function. No schema change needed here because
    -- Postgres vector columns accept only fixed dimensions; instead we add a new
    -- column for the pipeline's 768-dim embeddings.
    ALTER TABLE public.document_chunks
      ADD COLUMN IF NOT EXISTS embedding_768 extensions.vector(768);
  END IF;
END $$;

-- Indexes for document_chunks (existing table has id TEXT PK, no chunk_index)
CREATE INDEX IF NOT EXISTS idx_document_chunks_workspace_doc
  ON public.document_chunks (workspace_id, document_id);

-- ==========================================
-- 4. SEARCH QUERIES LOG (for analytics)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  search_type TEXT NOT NULL CHECK (search_type IN ('keyword', 'semantic', 'hybrid')),
  filters JSONB DEFAULT '{}',               -- Applied filters (document_ids, date_range, etc.)
  results_count INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,                       -- Query latency in ms
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for search_queries
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their search history" ON public.search_queries
  FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Users can insert their search queries" ON public.search_queries
  FOR INSERT WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- Indexes for search_queries
CREATE INDEX IF NOT EXISTS idx_search_queries_workspace_created
  ON public.search_queries (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_queries_user_created
  ON public.search_queries (user_id, created_at DESC);

-- ==========================================
-- 5. HYBRID SEARCH FUNCTION
-- ==========================================
-- Hybrid search combining keyword (tsvector) and semantic (vector) search.
-- Schema note: document_chunks uses id TEXT PK with content/page_number columns
-- (from 20240722000002); document_embeddings stores the 768-dim vectors keyed by
-- (document_id, chunk_index). The join maps embedding chunk_index to the Nth
-- chunk of that page via row numbering on the chunks table's natural ordering.

-- Simpler and robust: hybrid search runs directly over document_chunks joined to
-- document_embeddings on (document_id) + chunk ordinality is encoded in the
-- chunk id ('<doc>_p<page>_c<n>'). To avoid fragile id parsing, embeddings store
-- their own chunk_text, so we rank semantically from document_embeddings and add
-- keyword score from document_chunks.search_vector by matching content.

CREATE OR REPLACE FUNCTION public.hybrid_search(
  p_workspace_id UUID,
  p_query_text TEXT,
  p_query_embedding extensions.vector(768),
  p_limit INTEGER DEFAULT 10,
  p_keyword_weight FLOAT DEFAULT 0.5,
  p_semantic_weight FLOAT DEFAULT 0.5,
  p_document_ids UUID[] DEFAULT NULL,
  p_min_similarity FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  document_id UUID,
  chunk_id TEXT,
  chunk_text TEXT,
  similarity FLOAT,
  keyword_rank FLOAT,
  combined_score FLOAT,
  page_number INTEGER,
  chunk_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT
      de.document_id,
      de.chunk_index,
      de.chunk_text,
      (1 - (de.embedding <=> p_query_embedding)) AS similarity,
      (de.metadata->>'page_number')::INTEGER AS emb_page
    FROM public.document_embeddings de
    WHERE de.workspace_id = p_workspace_id
      AND (p_document_ids IS NULL OR de.document_id = ANY(p_document_ids))
    ORDER BY de.embedding <=> p_query_embedding
    LIMIT p_limit * 4
  ),
  scored AS (
    SELECT
      sr.document_id,
      sr.chunk_index,
      sr.chunk_text,
      sr.similarity,
      COALESCE(ts_rank_cd(dc.search_vector, plainto_tsquery('simple', p_query_text)), 0) AS keyword_rank,
      COALESCE(dc.page_number, sr.emb_page) AS match_page_number,
      COALESCE(dc.chunk_type, 'paragraph') AS match_chunk_type
    FROM semantic_results sr
    LEFT JOIN public.document_chunks dc
      ON dc.document_id = sr.document_id
      AND dc.page_number = sr.emb_page
      AND left(dc.content, 120) = left(sr.chunk_text, 120)
  )
  SELECT
    document_id,
    chunk_index::TEXT AS chunk_id,
    chunk_text,
    similarity,
    keyword_rank,
    (p_semantic_weight * similarity + p_keyword_weight * keyword_rank) AS combined_score,
    match_page_number AS page_number,
    match_chunk_type AS chunk_type
  FROM scored
  WHERE similarity >= p_min_similarity
  ORDER BY combined_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.hybrid_search(UUID, TEXT, extensions.vector(768), INTEGER, FLOAT, FLOAT, UUID[], FLOAT) TO service_role;

-- ==========================================
-- 6. SEMANTIC SEARCH FUNCTION (vector only)
-- ==========================================
CREATE OR REPLACE FUNCTION public.semantic_search(
  p_workspace_id UUID,
  p_query_embedding extensions.vector(768),
  p_limit INTEGER DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.0,
  p_document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  document_id UUID,
  chunk_index INTEGER,
  chunk_text TEXT,
  similarity FLOAT,
  page_number INTEGER,
  chunk_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.document_id,
    de.chunk_index,
    de.chunk_text,
    (1 - (de.embedding <=> p_query_embedding)) AS similarity,
    (de.metadata->>'page_number')::INTEGER AS page_number,
    'paragraph'::TEXT AS chunk_type
  FROM public.document_embeddings de
  WHERE de.workspace_id = p_workspace_id
    AND (p_document_ids IS NULL OR de.document_id = ANY(p_document_ids))
    AND (1 - (de.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY de.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.semantic_search(UUID, extensions.vector(768), INTEGER, FLOAT, UUID[]) TO service_role;

-- ==========================================
-- 7. KEYWORD SEARCH FUNCTION (tsvector over document_chunks.search_vector)
-- ==========================================
CREATE OR REPLACE FUNCTION public.keyword_search(
  p_workspace_id UUID,
  p_query_text TEXT,
  p_limit INTEGER DEFAULT 10,
  p_document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  document_id UUID,
  chunk_id TEXT,
  chunk_text TEXT,
  keyword_rank FLOAT,
  page_number INTEGER,
  chunk_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.document_id,
    dc.id AS chunk_id,
    dc.content AS chunk_text,
    ts_rank_cd(dc.search_vector, plainto_tsquery('simple', p_query_text)) AS keyword_rank,
    dc.page_number AS page_number,
    dc.chunk_type
  FROM public.document_chunks dc
  WHERE dc.workspace_id = p_workspace_id
    AND (p_document_ids IS NULL OR dc.document_id = ANY(p_document_ids))
    AND dc.search_vector @@ plainto_tsquery('simple', p_query_text)
  ORDER BY keyword_rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.keyword_search(UUID, TEXT, INTEGER, UUID[]) TO service_role;

-- ==========================================
-- 8. GRANT PERMISSIONS
-- ==========================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_embeddings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO service_role;
GRANT SELECT, INSERT ON public.embedding_models TO service_role;
GRANT SELECT, INSERT ON public.search_queries TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;