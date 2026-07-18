-- ============================================================
-- Knowledge Layer: Flashcards, Glossary, Mind Maps, Timeline
-- ============================================================
-- Design decisions:
--   • All knowledge entities are scoped to both document and
--     workspace for consistent RLS enforcement.
--   • mind_map_nodes support a hierarchical structure via
--     parent_id self-reference with CASCADE delete.
--   • position_x/position_y on mind_map_nodes allows the UI
--     to persist canvas layout when the feature is built.
--   • All tables use created_at for append-only immutability
--     except flashcards and glossary which support updates
--     (user may edit front/back, fix definition typos).
-- ============================================================

-- Flashcards
CREATE TABLE public.flashcards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  front         TEXT        NOT NULL,
  back          TEXT        NOT NULL,
  page_number   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Glossary terms
CREATE TABLE public.glossary_terms (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  term          TEXT        NOT NULL,
  definition    TEXT        NOT NULL,
  page_number   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mind map nodes (hierarchical, self-referencing)
CREATE TABLE public.mind_map_nodes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label         TEXT        NOT NULL,
  parent_id     UUID        REFERENCES public.mind_map_nodes(id) ON DELETE CASCADE,
  position_x    FLOAT       NOT NULL DEFAULT 0.0,
  position_y    FLOAT       NOT NULL DEFAULT 0.0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Timeline events
CREATE TABLE public.timeline_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date_str      TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  page_number   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_flashcards_document_id      ON public.flashcards(document_id);
CREATE INDEX idx_glossary_terms_document_id  ON public.glossary_terms(document_id);
CREATE INDEX idx_mind_map_nodes_document_id  ON public.mind_map_nodes(document_id);
CREATE INDEX idx_mind_map_nodes_parent_id    ON public.mind_map_nodes(parent_id);
CREATE INDEX idx_timeline_events_document_id ON public.timeline_events(document_id);

-- Enable RLS
ALTER TABLE public.flashcards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glossary_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mind_map_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- Helper macro for DRY workspace-scoped policies
-- Flashcards
CREATE POLICY "Users can view flashcards in their workspaces"
  ON public.flashcards FOR SELECT
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can insert flashcards in their workspaces"
  ON public.flashcards FOR INSERT
  WITH CHECK ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can update flashcards in their workspaces"
  ON public.flashcards FOR UPDATE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can delete flashcards in their workspaces"
  ON public.flashcards FOR DELETE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

-- Glossary terms
CREATE POLICY "Users can view glossary terms in their workspaces"
  ON public.glossary_terms FOR SELECT
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can insert glossary terms in their workspaces"
  ON public.glossary_terms FOR INSERT
  WITH CHECK ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can update glossary terms in their workspaces"
  ON public.glossary_terms FOR UPDATE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can delete glossary terms in their workspaces"
  ON public.glossary_terms FOR DELETE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

-- Mind map nodes
CREATE POLICY "Users can view mind map nodes in their workspaces"
  ON public.mind_map_nodes FOR SELECT
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can insert mind map nodes in their workspaces"
  ON public.mind_map_nodes FOR INSERT
  WITH CHECK ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can update mind map nodes in their workspaces"
  ON public.mind_map_nodes FOR UPDATE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can delete mind map nodes in their workspaces"
  ON public.mind_map_nodes FOR DELETE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

-- Timeline events
CREATE POLICY "Users can view timeline events in their workspaces"
  ON public.timeline_events FOR SELECT
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can insert timeline events in their workspaces"
  ON public.timeline_events FOR INSERT
  WITH CHECK ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can update timeline events in their workspaces"
  ON public.timeline_events FOR UPDATE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
CREATE POLICY "Users can delete timeline events in their workspaces"
  ON public.timeline_events FOR DELETE
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );
