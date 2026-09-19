-- Follow-up cleanup from Supabase security/performance advisors.
-- Safe changes only: fixed search paths, covering FK indexes, exact duplicate
-- policy/index removal, and RLS auth-function init-plan optimization.

alter function public.claim_embedding_job(text) set search_path = public;
alter function public.create_workspace_credit_account() set search_path = public;
alter function public.ensure_edge_function_settings() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.handle_new_user_settings() set search_path = public;
alter function public.persist_edge_function_settings() set search_path = public;
alter function public.seed_default_highlight_categories() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.update_chat_session_timestamp() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;

-- Cover foreign-key columns used during parent deletes/joins.
create index if not exists idx_fk_credit_ledger_bucket_id on public.credit_ledger(bucket_id);
create index if not exists idx_fk_credit_ledger_job_id on public.credit_ledger(job_id);
create index if not exists idx_fk_credit_ledger_reservation_id on public.credit_ledger(reservation_id);
create index if not exists idx_fk_credit_reservations_job_id on public.credit_reservations(job_id);
create index if not exists idx_fk_embedding_jobs_workspace_id on public.embedding_jobs(workspace_id);
create index if not exists idx_fk_flashcards_workspace_id on public.flashcards(workspace_id);
create index if not exists idx_fk_glossary_terms_workspace_id on public.glossary_terms(workspace_id);
create index if not exists idx_fk_highlights_category_id on public.highlights(category_id);
create index if not exists idx_fk_mind_map_nodes_workspace_id on public.mind_map_nodes(workspace_id);
create index if not exists idx_fk_plan_prices_plan_id on public.plan_prices(plan_id);
create index if not exists idx_fk_provider_models_provider_id on public.provider_models(provider_id);
create index if not exists idx_fk_provider_pricing_model_id on public.provider_pricing(model_id);
create index if not exists idx_fk_purchases_package_id on public.purchases(package_id);
create index if not exists idx_fk_purchases_workspace_id on public.purchases(workspace_id);
create index if not exists idx_fk_subscriptions_plan_id on public.subscriptions(plan_id);
create index if not exists idx_fk_timeline_events_workspace_id on public.timeline_events(workspace_id);
create index if not exists idx_fk_usage_jobs_document_id on public.usage_jobs(document_id);
create index if not exists idx_fk_usage_jobs_model_id on public.usage_jobs(model_id);
create index if not exists idx_fk_workspace_members_user_id on public.workspace_members(user_id);

-- Remove confirmed duplicate indexes/constraints while preserving one equivalent.
drop index if exists public.idx_credit_ledger_workspace_consume_daily;
alter table public.document_pages
  drop constraint if exists document_pages_document_id_page_number_unique;

-- Remove exact duplicate SELECT policies created by historical migrations.
drop policy if exists credit_buckets_select_policy on public.credit_buckets;
drop policy if exists "Users can view their workspace ledger" on public.credit_ledger;
drop policy if exists credit_ledger_select_policy on public.credit_ledger;
drop policy if exists credit_reservations_select_policy on public.credit_reservations;

-- Supabase recommends evaluating auth.uid()/role()/jwt() once per statement
-- instead of once per row. Recreate only policies that actually contain one
-- of those calls, preserving command, roles, permissiveness and expressions.
do $$
declare
  r record;
  roles_sql text;
  new_qual text;
  new_check text;
  ddl text;
begin
  for r in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~ 'auth\.(uid|role|jwt)\(\)'
        or coalesce(with_check, '') ~ 'auth\.(uid|role|jwt)\(\)'
      )
  loop
    select string_agg(quote_ident(role_name::text), ', ')
      into roles_sql
    from unnest(r.roles) as role_name;

    new_qual := r.qual;
    new_check := r.with_check;

    if new_qual is not null then
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
      new_qual := replace(new_qual, 'auth.role()', '(select auth.role())');
      new_qual := replace(new_qual, 'auth.jwt()', '(select auth.jwt())');
    end if;
    if new_check is not null then
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
      new_check := replace(new_check, 'auth.role()', '(select auth.role())');
      new_check := replace(new_check, 'auth.jwt()', '(select auth.jwt())');
    end if;

    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);

    ddl := format(
      'create policy %I on %I.%I as %s for %s to %s',
      r.policyname,
      r.schemaname,
      r.tablename,
      r.permissive,
      r.cmd,
      roles_sql
    );

    if new_qual is not null then
      ddl := ddl || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      ddl := ddl || format(' with check (%s)', new_check);
    end if;

    execute ddl;
  end loop;
end;
$$;
