-- ============================================================
-- Highlights and Highlight Categories
-- ============================================================
-- Design decisions:
--   • A highlight is a per-page annotation with one or more
--     bounding rectangles (to support multi-line selections).
--   • Rects are stored as JSONB for flexibility; coordinates
--     are normalized (0.0–1.0) relative to the page viewport.
--   • Categories are per-workspace so teams can share them.
--   • Default categories are seeded via a trigger at workspace
--     creation — avoids per-user duplication.
-- ============================================================

-- Per-workspace highlight categories
CREATE TABLE public.highlight_categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  color         TEXT        NOT NULL DEFAULT '#fef08a',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Highlight annotations on document pages
CREATE TABLE public.highlights (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  page_index    INTEGER     NOT NULL CHECK (page_index >= 0),
  rects         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  text          TEXT        NOT NULL DEFAULT '',
  color         TEXT        NOT NULL DEFAULT '#fef08a',
  category_id   UUID        REFERENCES public.highlight_categories(id) ON DELETE SET NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_highlight_categories_workspace ON public.highlight_categories(workspace_id);
CREATE INDEX idx_highlights_document_id         ON public.highlights(document_id);
CREATE INDEX idx_highlights_document_page       ON public.highlights(document_id, page_index);
CREATE INDEX idx_highlights_workspace_id        ON public.highlights(workspace_id);

-- Enable RLS
ALTER TABLE public.highlight_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

-- Highlight categories: workspace-scoped
CREATE POLICY "Users can view highlight categories in their workspaces"
  ON public.highlight_categories FOR SELECT
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

CREATE POLICY "Users can insert highlight categories in their workspaces"
  ON public.highlight_categories FOR INSERT
  WITH CHECK ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

CREATE POLICY "Users can update highlight categories in their workspaces"
  ON public.highlight_categories FOR UPDATE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

CREATE POLICY "Users can delete highlight categories in their workspaces"
  ON public.highlight_categories FOR DELETE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

-- Highlights: workspace-scoped
CREATE POLICY "Users can view highlights in their workspaces"
  ON public.highlights FOR SELECT
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

CREATE POLICY "Users can insert highlights in their workspaces"
  ON public.highlights FOR INSERT
  WITH CHECK ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

CREATE POLICY "Users can update highlights in their workspaces"
  ON public.highlights FOR UPDATE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

CREATE POLICY "Users can delete highlights in their workspaces"
  ON public.highlights FOR DELETE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

-- Seed default categories whenever a new workspace is created
CREATE OR REPLACE FUNCTION public.seed_default_highlight_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.highlight_categories (workspace_id, name, color) VALUES
    (NEW.id, 'Important',  '#fef08a'),
    (NEW.id, 'Definition', '#bfdbfe'),
    (NEW.id, 'Question',   '#fecaca');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_workspace_created_seed_categories
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE PROCEDURE public.seed_default_highlight_categories();

-- Backfill categories for existing workspaces
INSERT INTO public.highlight_categories (workspace_id, name, color)
SELECT w.id, c.name, c.color
FROM public.workspaces w
CROSS JOIN (VALUES
  ('Important',  '#fef08a'),
  ('Definition', '#bfdbfe'),
  ('Question',   '#fecaca')
) AS c(name, color)
ON CONFLICT DO NOTHING;
