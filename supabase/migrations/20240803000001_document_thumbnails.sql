-- Add thumbnail support to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_generated_at TIMESTAMPTZ;

-- Index for documents with thumbnails
CREATE INDEX IF NOT EXISTS idx_documents_thumbnail ON public.documents(workspace_id) WHERE thumbnail_path IS NOT NULL;

-- Enable pgvector for future thumbnail embeddings (optional)
-- CREATE EXTENSION IF NOT EXISTS vector;