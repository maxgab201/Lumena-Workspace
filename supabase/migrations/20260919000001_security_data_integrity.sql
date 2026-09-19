-- Security + data-integrity hardening for Lumena.
-- Applied after the September 2026 audit.

create schema if not exists private;

-- Persist the UI language instead of silently failing on a non-existent column.
alter table public.user_settings
  add column if not exists lang text not null default 'en'
  check (lang in ('en', 'es'));

alter table public.user_settings
  add column if not exists email_notifications boolean not null default true,
  add column if not exists desktop_notifications boolean not null default true,
  add column if not exists weekly_digest boolean not null default false;

-- Profile avatars: public reads, user-owned writes, 2 MB max.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile_avatars',
  'profile_avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read profile avatars" on storage.objects;
create policy "Public can read profile avatars"
on storage.objects for select
using (bucket_id = 'profile_avatars');

drop policy if exists "Users can upload own profile avatar" on storage.objects;
create policy "Users can upload own profile avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile_avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update own profile avatar" on storage.objects;
create policy "Users can update own profile avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile_avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile_avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete own profile avatar" on storage.objects;
create policy "Users can delete own profile avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile_avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Authenticated workspace creation must be atomic and bypass the INSERT RLS gap.
create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_name text := btrim(workspace_name);
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if v_name is null or length(v_name) = 0 or length(v_name) > 100 then
    raise exception 'invalid_workspace_name';
  end if;

  insert into public.workspaces(name)
  values (v_name)
  returning id into v_workspace_id;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner');

  return v_workspace_id;
end;
$$;

-- Client watchdog may only reap stale jobs belonging to one of the caller's workspaces.
create or replace function public.reap_stale_processing_jobs(stale_minutes integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reaped integer := 0;
  r record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  for r in
    select pj.id, pj.document_id
    from public.processing_jobs pj
    where pj.status in ('queued', 'inspecting', 'extracting', 'processing', 'retrying')
      and pj.progress_heartbeat < now() - make_interval(mins => greatest(1, stale_minutes))
      and exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = pj.workspace_id
          and wm.user_id = v_user_id
      )
    for update skip locked
  loop
    update public.processing_jobs
       set status = 'failed',
           error_message = 'Processing interrupted (service restarted or timed out). Retry to resume — completed pages are kept.',
           updated_at = now()
     where id = r.id;

    update public.documents
       set status = case when status::text = 'ready' then 'ready'::document_status else 'error'::document_status end,
           updated_at = now()
     where id = r.document_id;

    v_reaped := v_reaped + 1;
  end loop;

  return v_reaped;
end;
$$;

-- A storage move and DB move are coordinated by the client. This RPC performs
-- the DB half atomically and updates all workspace-scoped document artifacts.
create or replace function public.move_document_workspace(
  p_document_id uuid,
  p_target_workspace_id uuid,
  p_new_file_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_workspace_id uuid;
  v_file_hash text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select workspace_id, file_hash
    into v_source_workspace_id, v_file_hash
  from public.documents
  where id = p_document_id
  for update;

  if v_source_workspace_id is null then
    raise exception 'document_not_found';
  end if;

  if v_source_workspace_id = p_target_workspace_id then
    return;
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = v_source_workspace_id
      and user_id = v_user_id
      and role in ('owner', 'member')
  ) then
    raise exception 'source_workspace_forbidden';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_target_workspace_id
      and user_id = v_user_id
      and role in ('owner', 'member')
  ) then
    raise exception 'target_workspace_forbidden';
  end if;

  if exists (
    select 1 from public.processing_jobs
    where document_id = p_document_id
      and status in ('queued', 'inspecting', 'extracting', 'ocr', 'layout', 'processing', 'retrying', 'paused')
  ) then
    raise exception 'document_is_processing';
  end if;

  if exists (
    select 1 from public.documents
    where workspace_id = p_target_workspace_id
      and file_hash = v_file_hash
      and id <> p_document_id
  ) then
    raise exception 'duplicate_document';
  end if;

  update public.chat_sessions set workspace_id = p_target_workspace_id where document_id = p_document_id;
  update public.document_chunks set workspace_id = p_target_workspace_id where document_id = p_document_id;
  update public.document_embeddings set workspace_id = p_target_workspace_id where document_id = p_document_id;
  update public.document_page_segments set workspace_id = p_target_workspace_id where document_id = p_document_id;
  update public.embedding_jobs set workspace_id = p_target_workspace_id where document_id = p_document_id;
  update public.flashcards set workspace_id = p_target_workspace_id where document_id = p_document_id;
  update public.glossary_terms set workspace_id = p_target_workspace_id where document_id = p_document_id;
  update public.highlights
     set workspace_id = p_target_workspace_id,
         category_id = null
   where document_id = p_document_id;
  update public.mind_map_nodes set workspace_id = p_target_workspace_id where document_id = p_document_id;
  update public.timeline_events set workspace_id = p_target_workspace_id where document_id = p_document_id;

  update public.documents
     set workspace_id = p_target_workspace_id,
         file_path = p_new_file_path,
         updated_at = now()
   where id = p_document_id;
end;
$$;

-- One-time dispatch tokens protect process-document's public trigger ingress.
create table if not exists private.processing_dispatch_tokens (
  job_id uuid primary key references public.processing_jobs(id) on delete cascade,
  token uuid not null unique,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz
);

create or replace function public.consume_processing_dispatch(
  p_job_id uuid,
  p_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_valid boolean := false;
begin
  update private.processing_dispatch_tokens
     set used_at = now()
   where job_id = p_job_id
     and token = p_token
     and used_at is null
     and expires_at > now()
  returning true into v_valid;

  return coalesce(v_valid, false);
end;
$$;

create or replace function public.trigger_processing_job_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  v_anon_key text;
  v_dispatch_token uuid;
begin
  if new.status = 'queued' and (tg_op = 'INSERT' or old.status is distinct from 'queued') then
    begin
      select value into v_anon_key
      from private.app_config
      where key = 'edge_function_anon_key';

      v_dispatch_token := gen_random_uuid();

      insert into private.processing_dispatch_tokens(job_id, token, expires_at, used_at)
      values (new.id, v_dispatch_token, now() + interval '10 minutes', null)
      on conflict (job_id) do update
        set token = excluded.token,
            expires_at = excluded.expires_at,
            used_at = null;

      perform net.http_post(
        url := 'https://nsjetmjtwbhellqasggw.supabase.co/functions/v1/process-document',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(v_anon_key, '')
        ),
        body := jsonb_build_object(
          'record', to_jsonb(new),
          'dispatch_token', v_dispatch_token
        )
      );
    exception when others then
      raise warning 'Failed to trigger processing webhook: %', sqlerrm;
    end;
  end if;

  return new;
end;
$$;

-- Default PostgreSQL function privileges made every SECURITY DEFINER RPC callable
-- by PUBLIC. Close that surface and explicitly reopen only audited client RPCs.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
    execute format('grant execute on function %s to service_role', r.signature);
  end loop;
end;
$$;

grant execute on function public.get_user_workspace_ids() to authenticated;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.reap_stale_processing_jobs(integer) to authenticated;
grant execute on function public.move_document_workspace(uuid, uuid, text) to authenticated;

revoke execute on function public.consume_processing_dispatch(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_processing_dispatch(uuid, uuid) to service_role;
