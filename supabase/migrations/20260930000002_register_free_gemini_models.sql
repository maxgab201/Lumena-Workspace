-- Register the Free-plan Gemini models in the provider registry.
--
-- The ai-gateway meters every chat request against `provider_models` + `provider_pricing`
-- and throws "Model <code> not found or inactive" when the requested code has no active row.
-- The model catalog (supabase/functions/_shared/modelCatalog.ts) declares gemini-3.1-flash-lite
-- and gemini-3.5-flash-lite as the FREE Gemini whitelist, but production only had rows for the
-- Pro models and the OpenRouter ':free' one. Result: every Free-plan chat request failed on the
-- Gemini step and fell through to OpenRouter, so chat had no working model once the
-- OpenRouter free slug was retired (production evidence: 2026-09-30, all three free models
-- answered 500 "All models in fallback chain failed").
--
-- Idempotent: safe to re-run, never touches existing rows. Prices are metering placeholders
-- (Free requests are unmetered during the alpha, see ALPHA_UNMETERED in ai-gateway) and mirror
-- the existing Flash seed.

insert into public.provider_models (provider_id, code, name, max_input_tokens, max_output_tokens)
select p.id, m.code, m.name, 1000000, 8192
from public.providers p
cross join (values
  ('gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite'),
  ('gemini-3.5-flash-lite', 'Gemini 3.5 Flash Lite')
) as m(code, name)
where p.code = 'google'
on conflict (code) do nothing;

insert into public.provider_pricing (model_id, input_price_per_1k, output_price_per_1k)
select pm.id, 0.0001, 0.0003
from public.provider_models pm
where pm.code in ('gemini-3.1-flash-lite', 'gemini-3.5-flash-lite')
  and not exists (select 1 from public.provider_pricing pp where pp.model_id = pm.id);
