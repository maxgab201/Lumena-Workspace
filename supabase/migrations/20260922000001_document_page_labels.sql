-- Logical / printed page labels for PDF navigation.
-- PDF-native labels remain derived from PDF.js; this table stores user corrections.
CREATE TABLE IF NOT EXISTS public.document_page_labels (
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  label TEXT NOT NULL CHECK (length(trim(label)) > 0 AND length(label) <= 32),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_document_page_labels_workspace
  ON public.document_page_labels(workspace_id, document_id);

ALTER TABLE public.document_page_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view page labels in their workspaces" ON public.document_page_labels;
CREATE POLICY "Users can view page labels in their workspaces"
  ON public.document_page_labels FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

DROP POLICY IF EXISTS "Users can insert page labels in their workspaces" ON public.document_page_labels;
CREATE POLICY "Users can insert page labels in their workspaces"
  ON public.document_page_labels FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

DROP POLICY IF EXISTS "Users can update page labels in their workspaces" ON public.document_page_labels;
CREATE POLICY "Users can update page labels in their workspaces"
  ON public.document_page_labels FOR UPDATE
  USING (workspace_id IN (SELECT public.get_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids()));

DROP POLICY IF EXISTS "Users can delete page labels in their workspaces" ON public.document_page_labels;
CREATE POLICY "Users can delete page labels in their workspaces"
  ON public.document_page_labels FOR DELETE
  USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

COMMENT ON TABLE public.document_page_labels IS
  'Manual corrections for logical/printed page labels. PDF-native labels are read directly from PDF.js.';
