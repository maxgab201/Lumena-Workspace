-- Fix infinite recursion in workspace_members policy

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view memberships of their workspaces." ON public.workspace_members;

-- We want users to see ALL members of any workspace they are a part of.
-- To avoid the RLS infinite recursion when querying the same table, we can create a SECURITY DEFINER function
-- that returns the workspace IDs a user belongs to.

CREATE OR REPLACE FUNCTION public.get_user_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid();
$$;

-- Create the new policy using the security definer function
CREATE POLICY "Users can view memberships of their workspaces."
  ON public.workspace_members FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_user_workspace_ids())
  );

-- We also need to fix the workspaces table policy which had the exact same infinite recursion vector
-- because it also queried workspace_members directly in its policy.

DROP POLICY IF EXISTS "Users can view their workspaces." ON public.workspaces;

CREATE POLICY "Users can view their workspaces."
  ON public.workspaces FOR SELECT
  USING (
    id IN (SELECT public.get_user_workspace_ids())
  );
