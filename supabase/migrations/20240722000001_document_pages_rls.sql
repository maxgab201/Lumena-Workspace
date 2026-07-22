-- Migration: Add UNIQUE constraint and RLS policies for document_pages
-- The table already exists (created by 20240725000001_add_analysis_tables.sql)
-- This migration adds:
-- 1. UNIQUE constraint on (document_id, page_number) for UPSERT support
-- 2. RLS policies for authenticated users

-- 1. UNIQUE constraint (required for onConflict in upsert)
ALTER TABLE document_pages
  ADD CONSTRAINT document_pages_document_id_page_number_unique
  UNIQUE (document_id, page_number);

-- 2. Enable RLS (if not already enabled)
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;

-- 3. Policies: authenticated users can CRUD pages for documents in their workspaces
CREATE POLICY "document_pages_select_policy"
  ON document_pages FOR SELECT
  TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN workspace_members wm ON wm.workspace_id = d.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "document_pages_insert_policy"
  ON document_pages FOR INSERT
  TO authenticated
  WITH CHECK (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN workspace_members wm ON wm.workspace_id = d.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "document_pages_update_policy"
  ON document_pages FOR UPDATE
  TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN workspace_members wm ON wm.workspace_id = d.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- 4. Service role can do everything (for Edge Functions)
CREATE POLICY "document_pages_service_role_policy"
  ON document_pages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
