-- Harden logical-page label RLS by binding each label row to the
-- workspace that actually owns the referenced document.
DROP POLICY IF EXISTS "Users can view page labels in their workspaces" ON public.document_page_labels;
CREATE POLICY "Users can view page labels in their workspaces"
  ON public.document_page_labels FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_user_workspace_ids())
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_page_labels.document_id
        AND d.workspace_id = document_page_labels.workspace_id
    )
  );

DROP POLICY IF EXISTS "Users can insert page labels in their workspaces" ON public.document_page_labels;
CREATE POLICY "Users can insert page labels in their workspaces"
  ON public.document_page_labels FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_user_workspace_ids())
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_page_labels.document_id
        AND d.workspace_id = document_page_labels.workspace_id
    )
  );

DROP POLICY IF EXISTS "Users can update page labels in their workspaces" ON public.document_page_labels;
CREATE POLICY "Users can update page labels in their workspaces"
  ON public.document_page_labels FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_user_workspace_ids())
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_page_labels.document_id
        AND d.workspace_id = document_page_labels.workspace_id
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_user_workspace_ids())
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_page_labels.document_id
        AND d.workspace_id = document_page_labels.workspace_id
    )
  );

DROP POLICY IF EXISTS "Users can delete page labels in their workspaces" ON public.document_page_labels;
CREATE POLICY "Users can delete page labels in their workspaces"
  ON public.document_page_labels FOR DELETE
  USING (
    workspace_id IN (SELECT public.get_user_workspace_ids())
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_page_labels.document_id
        AND d.workspace_id = document_page_labels.workspace_id
    )
  );
