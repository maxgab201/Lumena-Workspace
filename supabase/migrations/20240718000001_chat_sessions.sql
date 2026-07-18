-- ============================================================
-- Chat Sessions and Messages
-- ============================================================
-- Design decisions:
--   • One session per user per document. The application creates
--     or retrieves it automatically when a document is opened.
--   • Messages are append-only; assistant messages are initially
--     inserted with empty content and updated on stream completion.
--   • References (e.g. highlights, page citations) are stored as
--     JSONB for schema flexibility as the AI layer evolves.
-- ============================================================

-- Chat session: one per (user, document) pair
CREATE TABLE public.chat_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, user_id)
);

-- Individual messages within a session
CREATE TYPE chat_role AS ENUM ('user', 'assistant', 'system');

CREATE TABLE public.chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role        chat_role   NOT NULL,
  content     TEXT        NOT NULL DEFAULT '',
  message_references  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_sessions_document_id  ON public.chat_sessions(document_id);
CREATE INDEX idx_chat_sessions_user_id      ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_workspace_id ON public.chat_sessions(workspace_id);
CREATE INDEX idx_chat_messages_session_id   ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at   ON public.chat_messages(created_at);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat sessions: scoped to workspace membership
CREATE POLICY "Users can view chat sessions in their workspaces"
  ON public.chat_sessions FOR SELECT
  USING ( workspace_id IN (SELECT public.get_user_workspace_ids()) );

CREATE POLICY "Users can insert chat sessions in their workspaces"
  ON public.chat_sessions FOR INSERT
  WITH CHECK ( workspace_id IN (SELECT public.get_user_workspace_ids()) AND user_id = auth.uid() );

CREATE POLICY "Users can update their own chat sessions"
  ON public.chat_sessions FOR UPDATE
  USING ( user_id = auth.uid() );

CREATE POLICY "Users can delete their own chat sessions"
  ON public.chat_sessions FOR DELETE
  USING ( user_id = auth.uid() );

-- Chat messages: accessible if the session's workspace is accessible
CREATE POLICY "Users can view messages in their sessions"
  ON public.chat_messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.chat_sessions
      WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
    )
  );

CREATE POLICY "Users can insert messages in their sessions"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.chat_sessions
      WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
    )
  );

CREATE POLICY "Users can update messages in their sessions"
  ON public.chat_messages FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM public.chat_sessions
      WHERE workspace_id IN (SELECT public.get_user_workspace_ids())
    )
  );

-- Auto-update updated_at on chat_sessions
CREATE OR REPLACE FUNCTION public.update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_chat_message_inserted
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE PROCEDURE public.update_chat_session_timestamp();
