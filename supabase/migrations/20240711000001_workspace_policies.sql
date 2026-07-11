CREATE POLICY "Owners can update their workspaces."
  ON public.workspaces FOR UPDATE
  USING (
    id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can delete their workspaces."
  ON public.workspaces FOR DELETE
  USING (
    id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'owner')
  );
