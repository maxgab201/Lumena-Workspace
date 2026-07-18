import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { ProviderRouter } from "./router.ts"
import type { AIProvider } from "./providers/Provider.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const router = new ProviderRouter()

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const payload = await req.json()
    const { prompt, workspace_id, action_type = 'chat', model_code = 'gemini-1.5-pro', fallback_models, document_id = null } = payload

    if (!prompt || !workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing prompt or workspace_id' }), { status: 400, headers: corsHeaders })
    }

    // ==========================================
    // SECURITY 1: Prompt Injection Check
    // ==========================================
    const injectionRegex = /(ignore\s+(all\s+)?(previous\s+)?instructions|system\s+prompt|system\s+override|forget\s+(all\s+)?previous)/i;
    if (injectionRegex.test(prompt)) {
      // Log Security Event
      await supabaseClient.from('security_events').insert({
        workspace_id,
        user_id: user.id,
        event_type: 'prompt_injection',
        severity: 'HIGH',
        signal: prompt.substring(0, 200), // Log snippet for audit
        metadata: { action_type }
      });
      return new Response(JSON.stringify({ error: 'Malicious prompt detected and blocked.' }), { status: 400, headers: corsHeaders });
    }

    // ==========================================
    // SECURITY 2: Rate Limiting (Fixed Window)
    // ==========================================
    // 50 actions per hour
    const ACTION_LIMIT = 50;
    const now = new Date();
    // Get start of the current hour
    const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0).toISOString();
    
    // Fallback if RPC isn't created yet (for prototyping, we do upsert in TS, though prone to race conditions)
    // Actually, we can just do a standard select + insert/update or rely on unique constraint
    let currentCount = 0;
    const { data: existingLimit } = await supabaseClient
      .from('rate_limit_counters')
      .select('id, count')
      .eq('scope_type', 'workspace')
      .eq('scope_id', workspace_id)
      .eq('metric', 'actions_per_hour')
      .eq('window_start', windowStart)
      .single();

    if (existingLimit) {
      currentCount = existingLimit.count + 1;
      await supabaseClient.from('rate_limit_counters').update({ count: currentCount }).eq('id', existingLimit.id);
    } else {
      currentCount = 1;
      await supabaseClient.from('rate_limit_counters').insert({
        scope_type: 'workspace',
        scope_id: workspace_id,
        metric: 'actions_per_hour',
        window_start: windowStart,
        count: currentCount
      });
    }

    if (currentCount > ACTION_LIMIT) {
      await supabaseClient.from('security_events').insert({
        workspace_id,
        user_id: user.id,
        event_type: 'rate_limit',
        severity: 'MEDIUM',
        metadata: { limit: ACTION_LIMIT, metric: 'actions_per_hour' }
      });
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), { status: 429, headers: corsHeaders });
    }

    // ==========================================
    // SECURITY 3: Circuit Breaker (Daily Cap)
    // ==========================================
    const DAILY_CREDIT_CAP = 10000;
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();

    const { data: dailyUsage } = await supabaseClient
      .from('credit_ledger')
      .select('amount')
      .eq('workspace_id', workspace_id)
      .eq('entry_type', 'consume')
      .gte('created_at', dayStart);

    const totalConsumedToday = dailyUsage ? dailyUsage.reduce((acc, row) => acc + row.amount, 0) : 0;

    if (totalConsumedToday > DAILY_CREDIT_CAP) {
      await supabaseClient.from('security_events').insert({
        workspace_id,
        user_id: user.id,
        event_type: 'circuit_breaker',
        severity: 'HIGH',
        metadata: { cap: DAILY_CREDIT_CAP, consumed: totalConsumedToday }
      });
      return new Response(JSON.stringify({ error: 'Daily credit cap reached. Circuit breaker tripped.' }), { status: 403, headers: corsHeaders });
    }

    // ==========================================
    // ROUTING & EXECUTION
    // ==========================================
    const chain = fallback_models || [model_code, 'gemini-1.5-flash']

    const { result, usedModel } = await router.routeWithFallback(
      chain,
      prompt,
      async (currentModelCode: string, provider: AIProvider) => {
        const { data: modelData, error: modelError } = await supabaseClient
          .from('provider_models')
          .select('id, provider_id, max_output_tokens, provider_pricing(input_price_per_1k, output_price_per_1k, credit_conversion_rate)')
          .eq('code', currentModelCode)
          .eq('is_active', true)
          .single()

        if (modelError || !modelData || !modelData.provider_pricing || modelData.provider_pricing.length === 0) {
          throw new Error(`Model ${currentModelCode} not found or inactive`)
        }

        const pricing = modelData.provider_pricing[0]
        
        const estimatedInputTokens = Math.max(10, Math.ceil(prompt.length / 4))
        const estimatedOutputTokens = 1000 

        const estimatedInputCostUsd = (estimatedInputTokens / 1000) * pricing.input_price_per_1k
        const estimatedOutputCostUsd = (estimatedOutputTokens / 1000) * pricing.output_price_per_1k
        const totalEstimatedUsd = estimatedInputCostUsd + estimatedOutputCostUsd
        
        const reservedCredits = Math.max(1, Math.ceil(totalEstimatedUsd * pricing.credit_conversion_rate))

        const { data: accountData } = await supabaseClient
          .from('credit_accounts')
          .select('available, reserved')
          .eq('workspace_id', workspace_id)
          .single()

        if (!accountData || accountData.available < reservedCredits) {
          const insufficientErr = new Error('Insufficient credits')
          ;(insufficientErr as any).status = 402
          ;(insufficientErr as any).required = reservedCredits
          ;(insufficientErr as any).available = accountData?.available || 0
          throw insufficientErr
        }

        const { data: usageJob, error: jobError } = await supabaseClient
          .from('usage_jobs')
          .insert({
            workspace_id,
            document_id,
            action_type,
            model_id: modelData.id,
            status: 'pending'
          })
          .select('id')
          .single()

        if (jobError) throw new Error('Failed to create usage job')

        await supabaseClient.from('credit_accounts').update({
          available: accountData.available - reservedCredits,
          reserved: accountData.reserved + reservedCredits
        }).eq('workspace_id', workspace_id)

        let providerResult;
        try {
          providerResult = await provider.generate(currentModelCode, prompt)
        } catch (llmError: any) {
          await supabaseClient.from('credit_accounts').update({
            available: accountData.available,
            reserved: accountData.reserved
          }).eq('workspace_id', workspace_id)

          await supabaseClient.from('usage_jobs').update({
            status: 'failed',
            error_details: llmError.message,
            completed_at: new Date().toISOString()
          }).eq('id', usageJob.id)

          throw llmError
        }

        const inputTokens = providerResult.usage.inputTokens
        const outputTokens = providerResult.usage.outputTokens
        const actualInputCostUsd = (inputTokens / 1000) * pricing.input_price_per_1k
        const actualOutputCostUsd = (outputTokens / 1000) * pricing.output_price_per_1k
        const totalActualUsd = actualInputCostUsd + actualOutputCostUsd
        
        const actualCostCredits = Math.max(1, Math.ceil(totalActualUsd * pricing.credit_conversion_rate))

        await supabaseClient.from('usage_jobs').update({
          status: 'success',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_cost_credits: actualCostCredits,
          completed_at: new Date().toISOString()
        }).eq('id', usageJob.id)

        await supabaseClient.from('credit_ledger').insert({
          workspace_id,
          entry_type: 'consume',
          amount: actualCostCredits,
          direction: -1,
          job_id: usageJob.id
        })

        const { data: finalAccount } = await supabaseClient
          .from('credit_accounts')
          .select('available, reserved, consumed')
          .eq('workspace_id', workspace_id)
          .single()

        if (finalAccount) {
          await supabaseClient.from('credit_accounts').update({
            reserved: Math.max(0, finalAccount.reserved - reservedCredits),
            available: finalAccount.available + (reservedCredits - actualCostCredits),
            consumed: finalAccount.consumed + actualCostCredits
          }).eq('workspace_id', workspace_id)
        }

        return {
          text: providerResult.text,
          usage: { inputTokens, outputTokens, costCredits: actualCostCredits }
        }
      }
    )

    return new Response(JSON.stringify({ 
      text: result.text,
      usage: result.usage,
      usedModel
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error('AI Gateway error:', err)
    
    if (err.status === 402) {
      return new Response(JSON.stringify({ 
        error: err.message, 
        required: err.required, 
        available: err.available 
      }), { status: 402, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: err.message }), { status: err.status || 500, headers: corsHeaders })
  }
})
