-- Phase 18: Advanced Security Tables

-- ==========================================
-- 1. SECURITY EVENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID, -- If user is known
  event_type TEXT NOT NULL, -- e.g. 'prompt_injection', 'circuit_breaker', 'rate_limit'
  severity TEXT NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
  signal TEXT, -- the offending string or trigger
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. RATE LIMIT COUNTERS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL, -- e.g. 'workspace'
  scope_id UUID NOT NULL, -- e.g. workspace_id
  metric TEXT NOT NULL, -- e.g. 'actions_per_hour'
  window_start TIMESTAMPTZ NOT NULL, -- start of the rolling or fixed window
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope_type, scope_id, metric, window_start)
);

-- ==========================================
-- TRIGGERS & RLS
-- ==========================================
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Only admins/service role can write. Users can read their own workspace's events.
CREATE POLICY "Users can read their workspace security events" ON public.security_events 
FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Rate limits are fully internal, no client access needed.
