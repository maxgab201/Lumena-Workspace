-- Migration: Atomic Rate Limiting RPC
-- Provides race-condition-free rate limiting using PostgreSQL ON CONFLICT upsert

-- Atomic rate limit check and increment
-- Returns: { allowed: boolean, current_count: integer, limit: integer, reset_at: timestamptz }
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_scope_type TEXT,
  p_scope_id UUID,
  p_metric TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER DEFAULT 3600
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_reset_at TIMESTAMPTZ;
  v_current_count INTEGER;
  v_allowed BOOLEAN;
  v_result JSONB;
BEGIN
  -- Calculate window start (aligned to window boundaries)
  v_window_start := date_trunc('hour', NOW()) - (EXTRACT(MINUTE FROM NOW())::INTEGER % (p_window_seconds / 60)) * INTERVAL '1 minute';
  v_reset_at := v_window_start + p_window_seconds * INTERVAL '1 second';

  -- Atomic upsert: insert new counter or increment existing
  -- Uses ON CONFLICT to handle concurrent requests atomically
  INSERT INTO public.rate_limit_counters (scope_type, scope_id, metric, window_start, count)
  VALUES (p_scope_type, p_scope_id, p_metric, v_window_start, 1)
  ON CONFLICT (scope_type, scope_id, metric, window_start)
  DO UPDATE SET
    count = rate_limit_counters.count + 1
  RETURNING count INTO v_current_count;

  v_allowed := v_current_count <= p_limit;

  v_result := jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_current_count,
    'limit', p_limit,
    'reset_at', v_reset_at
  );

  -- If not allowed, we could optionally decrement, but better to keep count for monitoring
  -- The counter will naturally expire when the window passes

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, UUID, TEXT, INTEGER, INTEGER) TO service_role;


-- Cleanup old rate limit counters (called by pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_counters(
  p_older_than INTERVAL DEFAULT '24 hours'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  DELETE FROM public.rate_limit_counters
  WHERE window_start < NOW() - p_older_than;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_counters(INTERVAL) TO service_role;