-- Give back the Free-plan daily AI request when the gateway could not serve it.
--
-- ai-gateway consumes one unit of the 50/day Free quota BEFORE it calls any provider. When every
-- provider failed (upstream 429/5xx, retired model), or the request was refused afterwards
-- (hourly rate limit, circuit breaker, no allowed model), the user lost a unit and got nothing.
-- Production evidence: 19 of 50 units of the QA workspace were spent that way in one day.
--
-- Same access model as consume_ai_request: SECURITY DEFINER and callable only by service_role,
-- so a client cannot give itself requests back. It only ever lowers chat_count, never below 0,
-- and only for the day the unit was taken on (p_day), so a request that straddles midnight UTC
-- cannot refund a unit that today never spent.

create or replace function public.refund_ai_request(p_workspace_id uuid, p_day date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.ai_daily_usage
     set chat_count = greatest(chat_count - 1, 0),
         updated_at = now()
   where workspace_id = p_workspace_id
     and day = p_day;
end;
$function$;

revoke all on function public.refund_ai_request(uuid, date) from public, anon, authenticated;
grant execute on function public.refund_ai_request(uuid, date) to service_role;
