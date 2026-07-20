-- Phase 23: AI Presentations storage
-- Stores AI-generated presentation slide decks per document

CREATE TABLE IF NOT EXISTS presentations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  slides      JSONB NOT NULL DEFAULT '[]',  -- [{index, title, bullets[], speaker_note}]
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_presentations_document_id ON presentations(document_id);

-- Enable RLS
ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;

-- RLS: workspace members can read/write their workspace's presentations
CREATE POLICY "workspace_members_select_presentations"
  ON presentations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert_presentations"
  ON presentations FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_update_presentations"
  ON presentations FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_delete_presentations"
  ON presentations FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
