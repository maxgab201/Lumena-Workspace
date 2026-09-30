-- "Move documents to another workspace" relies on Storage move(), which UPDATEs the object's
-- name. The workspace_documents bucket has SELECT / INSERT / DELETE policies but no UPDATE
-- policy, so every move is answered "400 Object not found (NoSuchKey)" even though the object
-- exists. Verified against production on 2026-09-30 with the QA account: upload 200, copy 200,
-- move 400. The failure is safe (the client aborts before the database RPC runs), but the
-- feature has never worked. The CI E2E did not notice because it mocks Storage.
--
-- USING checks the source row, WITH CHECK checks the new name, so a move needs membership in
-- BOTH the source and the target workspace. Viewers are excluded, as in the move RPC.
--
-- NOT APPLIED to production yet: it changes access policies and needs explicit approval.

drop policy if exists "Members can move files between their workspaces" on storage.objects;

create policy "Members can move files between their workspaces"
on storage.objects for update
to authenticated
using (
  bucket_id = 'workspace_documents'
  and (storage.foldername(name))[1]::uuid in (
    select workspace_id
    from public.workspace_members
    where user_id = (select auth.uid())
      and role in ('owner', 'member')
  )
)
with check (
  bucket_id = 'workspace_documents'
  and (storage.foldername(name))[1]::uuid in (
    select workspace_id
    from public.workspace_members
    where user_id = (select auth.uid())
      and role in ('owner', 'member')
  )
);
