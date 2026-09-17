-- ─────────────────────────────────────────────────────────────────────────────
-- MODEL CATALOG + FREE DAILY QUOTA (Alpha)
-- Daily AI request quota shared by Chat + AI Highlight for Free workspaces.
-- UTC day window. Atomic consumption via consume_ai_request(). Core features
-- (reading, upload/extraction, OCR, manual highlights, notes) never consume.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ai_daily_usage (
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  day            date not null default (now() at time zone 'utc')::date,
  chat_count     integer not null default 0,
  highlight_count integer not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (workspace_id, day)
);

alter table public.ai_daily_usage enable row level security;
-- No RLS policies on purpose: only the service role (Edge Functions) reads or
-- writes this table. The frontend reads quota through the `ai-config` function.

-- Run tokens: one AI Highlight run = one quota request, regardless of how many
-- pages the run analyzes. ai-highlight validates the token on every page call.
create table if not exists public.ai_quota_runs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  day           date not null default (now() at time zone 'utc')::date,
  created_at    timestamptz not null default now()
);

create index if not exists ai_quota_runs_workspace_day_idx
  on public.ai_quota_runs (workspace_id, day);

alter table public.ai_quota_runs enable row level security;
-- Same as above: service-role only.

-- ─── Atomic consume: returns allowed=false when the daily cap is reached. ───
create or replace function public.consume_ai_request(
  p_workspace_id uuid,
  p_action       text,             -- 'chat' | 'ai_highlight'
  p_limit        integer default 50
)
returns table (allowed boolean, chat_count integer, highlight_count integer, run_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day   date := (now() at time zone 'utc')::date;
  v_chat  integer;
  v_hl    integer;
  v_token uuid;
begin
  if p_action not in ('chat', 'ai_highlight') then
    raise exception 'invalid_action';
  end if;

  insert into public.ai_daily_usage (workspace_id, day)
  values (p_workspace_id, v_day)
  on conflict (workspace_id, day) do nothing;

  select ai_daily_usage.chat_count, ai_daily_usage.highlight_count
    into v_chat, v_hl
    from public.ai_daily_usage
   where workspace_id = p_workspace_id and day = v_day
   for update;

  if (v_chat + v_hl) >= p_limit then
    return query select false, v_chat, v_hl, null::uuid;
    return;
  end if;

  if p_action = 'chat' then
    update public.ai_daily_usage
       set chat_count = ai_daily_usage.chat_count + 1, updated_at = now()
     where workspace_id = p_workspace_id and day = v_day
    returning ai_daily_usage.chat_count as chat_count, ai_daily_usage.highlight_count as highlight_count into v_chat, v_hl;
    v_token := null;
  else
    update public.ai_daily_usage
       set highlight_count = ai_daily_usage.highlight_count + 1, updated_at = now()
     where workspace_id = p_workspace_id and day = v_day
    returning ai_daily_usage.chat_count as chat_count, ai_daily_usage.highlight_count as highlight_count into v_chat, v_hl;
    insert into public.ai_quota_runs (workspace_id, day)
    values (p_workspace_id, v_day)
    returning id into v_token;
  end if;

  return query select true, v_chat, v_hl, v_token;
end;
$$;

-- ─── Read-only usage for the UI (17 / 50 AI requests today). ───
create or replace function public.get_ai_usage(p_workspace_id uuid)
returns table (chat_count integer, highlight_count integer, day date)
language sql
security definer
set search_path = public
as $$
  select coalesce(chat_count, 0), coalesce(highlight_count, 0),
         coalesce(day, (now() at time zone 'utc')::date)
    from public.ai_daily_usage
   where workspace_id = p_workspace_id
     and day = (now() at time zone 'utc')::date;
$$;
