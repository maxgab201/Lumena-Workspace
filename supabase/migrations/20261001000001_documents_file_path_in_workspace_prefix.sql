-- A document's file_path must live under its own workspace's Storage prefix.
--
-- Production audit (2026-10-01): any workspace member could point documents.file_path at an
-- arbitrary Storage path, either through move_document_workspace(p_new_file_path) (which stored
-- whatever it was given) or with a plain UPDATE (the documents UPDATE policy has no column
-- restriction). process-document downloads file_path with the service-role key, which bypasses
-- Storage RLS, so a path under ANOTHER workspace's prefix would be read into the attacker's
-- document. The attacker needs the other workspace's id and the file's content hash, so the
-- practical exposure is small, but nothing server-side bound the path to the workspace.
--
-- A CHECK constraint closes every writer at once (client UPDATE/INSERT, the move RPC). The move
-- RPC updates workspace_id and file_path in the same statement, so a legitimate move still
-- satisfies it. All existing rows already conform (27 of 27 when this was written); a NULL
-- file_path passes a CHECK, as before.

alter table public.documents
  add constraint documents_file_path_in_workspace_prefix
  check (file_path like workspace_id::text || '/%');
