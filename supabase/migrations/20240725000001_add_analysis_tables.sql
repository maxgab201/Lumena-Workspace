-- Lumena Workspace: Analysis Tables Migration
-- Adds tables for OCR, chunking, embeddings, AI analysis, and citations

-- Task type enum (prevents typos)
CREATE TYPE analysis_task_type AS ENUM (
  'ocr', 'layout', 'chunking', 'embeddings',
  'highlights', 'summary', 'glossary', 'timeline',
  'flashcards', 'mindmap', 'podcast', 'presentation'
);

-- Per-page text storage
CREATE TABLE document_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  raw_text TEXT,
  ocr_provider TEXT,
  confidence NUMERIC(3,2),
  layout_json JSONB,
  embedding_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, page_number)
);

-- Analysis tasks with dependencies
CREATE TABLE processing_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  task analysis_task_type NOT NULL,
  status TEXT DEFAULT 'pending',
  provider TEXT,
  model TEXT,
  version INTEGER DEFAULT 1,
  provider_version TEXT,
  prompt_version TEXT,
  schema_version TEXT,
  depends_on analysis_task_type[],
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Analysis cache
CREATE TABLE document_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  analysis_type analysis_task_type NOT NULL,
  provider TEXT,
  model TEXT,
  version INTEGER DEFAULT 1,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, analysis_type, version)
);

-- Bounding box cache
CREATE TABLE highlight_bboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID REFERENCES highlights(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  x NUMERIC(5,4),
  y NUMERIC(5,4),
  width NUMERIC(5,4),
  height NUMERIC(5,4),
  cached_at TIMESTAMPTZ DEFAULT now()
);

-- Document OCR status
ALTER TABLE documents ADD COLUMN ocr_status TEXT DEFAULT 'pending';

-- Indexes for performance
CREATE INDEX idx_document_pages_document_id ON document_pages(document_id);
CREATE INDEX idx_processing_tasks_document_id ON processing_tasks(document_id);
CREATE INDEX idx_processing_tasks_status ON processing_tasks(status);
CREATE INDEX idx_document_analysis_document_id ON document_analysis(document_id);
CREATE INDEX idx_highlight_bboxes_highlight_id ON highlight_bboxes(highlight_id);

-- RLS policies
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight_bboxes ENABLE ROW LEVEL SECURITY;

-- document_pages policies
CREATE POLICY "Users can view pages in their workspaces"
  ON document_pages FOR SELECT
  USING (document_id IN (
    SELECT id FROM documents WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert pages in their workspaces"
  ON document_pages FOR INSERT
  WITH CHECK (document_id IN (
    SELECT id FROM documents WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

-- processing_tasks policies
CREATE POLICY "Users can view tasks in their workspaces"
  ON processing_tasks FOR SELECT
  USING (document_id IN (
    SELECT id FROM documents WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert tasks in their workspaces"
  ON processing_tasks FOR INSERT
  WITH CHECK (document_id IN (
    SELECT id FROM documents WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can update tasks in their workspaces"
  ON processing_tasks FOR UPDATE
  USING (document_id IN (
    SELECT id FROM documents WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

-- document_analysis policies
CREATE POLICY "Users can view analysis in their workspaces"
  ON document_analysis FOR SELECT
  USING (document_id IN (
    SELECT id FROM documents WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert analysis in their workspaces"
  ON document_analysis FOR INSERT
  WITH CHECK (document_id IN (
    SELECT id FROM documents WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

-- highlight_bboxes policies
CREATE POLICY "Users can view bboxes in their workspaces"
  ON highlight_bboxes FOR SELECT
  USING (highlight_id IN (
    SELECT id FROM highlights WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert bboxes in their workspaces"
  ON highlight_bboxes FOR INSERT
  WITH CHECK (highlight_id IN (
    SELECT id FROM highlights WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));
