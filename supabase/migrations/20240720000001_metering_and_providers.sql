-- Phase 16: Metering & Core Actions

-- ==========================================
-- 1. PROVIDERS & MODELS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.provider_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  max_input_tokens INTEGER,
  max_output_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pricing uses a high-precision decimal or cents-per-1k-tokens
CREATE TABLE IF NOT EXISTS public.provider_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.provider_models(id) ON DELETE CASCADE,
  billing_interval_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  input_price_per_1k NUMERIC(10, 4) NOT NULL, -- USD
  output_price_per_1k NUMERIC(10, 4) NOT NULL, -- USD
  credit_conversion_rate NUMERIC(10, 4) NOT NULL DEFAULT 100, -- e.g. $1 = 100 credits
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. USAGE & METERING
-- ==========================================
CREATE TABLE IF NOT EXISTS public.usage_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- e.g. 'chat', 'extract', 'ocr'
  model_id UUID REFERENCES public.provider_models(id),
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_cost_credits INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed
  error_details TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ==========================================
-- TRIGGERS & RLS
-- ==========================================
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read active providers" ON public.providers FOR SELECT USING (is_active = true);
CREATE POLICY "Users can read active models" ON public.provider_models FOR SELECT USING (is_active = true);
-- Pricing is internal, users don't need direct read access to pricing tables.

CREATE POLICY "Users can read their workspace usage jobs" ON public.usage_jobs 
FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- ==========================================
-- SEED DATA
-- ==========================================
INSERT INTO public.providers (code, name) VALUES 
('google', 'Google'),
('openai', 'OpenAI')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.provider_models (provider_id, code, name, max_input_tokens, max_output_tokens)
SELECT id, 'gemini-1.5-flash', 'Gemini 1.5 Flash', 1000000, 8192 
FROM public.providers WHERE code = 'google'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.provider_models (provider_id, code, name, max_input_tokens, max_output_tokens)
SELECT id, 'gemini-1.5-pro', 'Gemini 1.5 Pro', 2000000, 8192 
FROM public.providers WHERE code = 'google'
ON CONFLICT (code) DO NOTHING;

-- Flash: roughly $0.075 / 1M input, $0.30 / 1M output => $0.000075 per 1k in, $0.0003 per 1k out
INSERT INTO public.provider_pricing (model_id, input_price_per_1k, output_price_per_1k)
SELECT id, 0.0001, 0.0003
FROM public.provider_models WHERE code = 'gemini-1.5-flash';

-- Pro: roughly $3.50 / 1M input, $10.50 / 1M output => $0.0035 per 1k in, $0.0105 per 1k out
INSERT INTO public.provider_pricing (model_id, input_price_per_1k, output_price_per_1k)
SELECT id, 0.0035, 0.0105
FROM public.provider_models WHERE code = 'gemini-1.5-pro';
