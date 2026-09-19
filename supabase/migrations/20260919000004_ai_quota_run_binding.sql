-- Bind free AI-highlight quota run tokens to one authorized user action.
-- A run may span multiple unique pages for document scope, but cannot be
-- replayed on the same page, moved to another user/document/model/action,
-- or reused after a short expiry.

alter table public.ai_quota_runs
  add column if not exists user_id uuid,
  add column if not exists document_id uuid references public.documents(id) on delete cascade,
  add column if not exists model_id text,
  add column if not exists action_hash text,
  add column if not exists used_pages integer[] not null default '{}'::integer[],
  add column if not exists expires_at timestamptz not null default (now() + interval '2 hours');

create index if not exists idx_ai_quota_runs_document_id
  on public.ai_quota_runs(document_id);

create or replace function public.consume_ai_quota_run_page(
  p_run_id uuid,
  p_workspace_id uuid,
  p_user_id uuid,
  p_document_id uuid,
  p_model_id text,
  p_action_hash text,
  p_page_number integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_allowed boolean := false;
begin
  if p_run_id is null
     or p_workspace_id is null
     or p_user_id is null
     or p_document_id is null
     or p_model_id is null
     or length(btrim(p_model_id)) = 0
     or p_action_hash is null
     or length(btrim(p_action_hash)) = 0
     or p_page_number is null
     or p_page_number < 1 then
    return false;
  end if;

  update public.ai_quota_runs
     set user_id = coalesce(user_id, p_user_id),
         document_id = coalesce(document_id, p_document_id),
         model_id = coalesce(model_id, p_model_id),
         action_hash = coalesce(action_hash, p_action_hash),
         used_pages = array_append(used_pages, p_page_number)
   where id = p_run_id
     and workspace_id = p_workspace_id
     and day = v_day
     and expires_at > now()
     and (user_id is null or user_id = p_user_id)
     and (document_id is null or document_id = p_document_id)
     and (model_id is null or model_id = p_model_id)
     and (action_hash is null or action_hash = p_action_hash)
     and not (used_pages @> array[p_page_number])
  returning true into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke execute on function public.consume_ai_quota_run_page(
  uuid, uuid, uuid, uuid, text, text, integer
) from public, anon, authenticated;
grant execute on function public.consume_ai_quota_run_page(
  uuid, uuid, uuid, uuid, text, text, integer
) to service_role;
