-- ============================================================
-- Checkpoint 3: OCR Real + AI Highlighting
-- ============================================================
-- Design decisions:
--   • highlights.source distinguishes manual vs AI highlights.
--     AI highlights reuse the exact same canonical geometry,
--     renderer, notes and persistence as manual ones.
--   • ai_metadata (JSONB) carries AI-specific fields (category,
--     confidence, model) without polluting the core schema.
--   • document_page_segments stores the per-page text inventory
--     with CANONICAL geometry (same unrotated normalized space as
--     highlights) for both native PDF.js text and OCR words. This
--     is the semantic anchor AI selects from and the geometry
--     source the client maps back to highlights.
--   • documents.ai_status tracks the AI-highlight layer separately
--     from core reading and ocr_status, so an AI failure can never
--     degrade the reader (Core-vs-AI separation).
-- ============================================================

-- 1. Highlights: manual vs AI provenance
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'highlights_source_check'
  ) THEN
    ALTER TABLE public.highlights
      ADD CONSTRAINT highlights_source_check CHECK (source IN ('manual', 'ai'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_highlights_source ON public.highlights(source);

-- 2. Per-page text inventory with canonical geometry.
--    One row per segment (native text item line or OCR word/line).
CREATE TABLE IF NOT EXISTS public.document_page_segments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  page_number   INTEGER     NOT NULL CHECK (page_number >= 1),
  -- Stable within a document version: e.g. "p3-native-12" / "p3-ocr-45"
  segment_key   TEXT        NOT NULL,
  text          TEXT        NOT NULL,
  -- Canonical unrotated normalized geometry (0..1), same space as highlights
  rects         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  origin        TEXT        NOT NULL DEFAULT 'native' CHECK (origin IN ('native', 'ocr')),
  confidence    NUMERIC(4,3),              -- OCR word/line confidence (0..1); null for native
  sequence      INTEGER     NOT NULL DEFAULT 0,  -- reading order within page
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, segment_key)
);

CREATE INDEX IF NOT EXISTS idx_document_page_segments_doc_page
  ON public.document_page_segments(document_id, page_number, sequence);
CREATE INDEX IF NOT EXISTS idx_document_page_segments_workspace
  ON public.document_page_segments(workspace_id);

ALTER TABLE public.document_page_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view page segments in their workspaces"
  ON public.document_page_segments FOR SELECT
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

CREATE POLICY "Users can insert page segments in their workspaces"
  ON public.document_page_segments FOR INSERT
  WITH CHECK ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

CREATE POLICY "Users can update page segments in their workspaces"
  ON public.document_page_segments FOR UPDATE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

CREATE POLICY "Users can delete page segments in their workspaces"
  ON public.document_page_segments FOR DELETE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

-- 3. Documents: AI layer status, fully decoupled from core reading
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'pending';

-- 4. Sync supabase typed client metadata (informational)
COMMENT ON TABLE public.document_page_segments IS
  'Per-page text inventory with canonical unrotated normalized geometry. origin=native (PDF.js) or ocr (Tesseract). AI selects segment_keys; geometry is resolved client-side — the AI never outputs coordinates.';
