-- Remove the final exact-overlap document_pages policies.
-- The existing public policies already apply to authenticated users and use
-- the same workspace-membership restriction, so these are redundant.
drop policy if exists document_pages_insert_policy on public.document_pages;
drop policy if exists document_pages_select_policy on public.document_pages;
