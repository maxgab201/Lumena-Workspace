import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { ProviderRouter } from "./router.ts"
import type { AIProvider } from "./providers/Provider.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation constants
const MAX_PROMPT_LENGTH = 50000;
const MIN_PROMPT_LENGTH = 1;

// Provider call timeout (ms)
const PROVIDER_TIMEOUT_MS = 60000;

// Helper to execute with timeout
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: number;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

const router = new ProviderRouter()

type Pricing = {
  input_price_per_1k: number
  output_price_per_1k: number
  credit_conversion_rate: number
}

// Settle the reservation after a successful generation and return actual cost.
async function settleCredits(
  supabaseClient: any,
  workspaceId: string,
  pricing: Pricing,
  reservedCredits: number,
  inputTokens: number,
  outputTokens: number,
  jobId: string,
): Promise<number> {
  const actualCostUsd = (inputTokens / 1000) * pricing.input_price_per_1k +
    (outputTokens / 1000) * pricing.output_price_per_1k
  const actualCostCredits = Math.max(1, Math.ceil(actualCostUsd * pricing.credit_conversion_rate))

  await supabaseClient.from('usage_jobs').update({
    status: 'success',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_cost_credits: actualCostCredits,
    completed_at: new Date().toISOString()
  }).eq('id', jobId)

  await supabaseClient.from('credit_ledger').insert({
    workspace_id: workspaceId,
    entry_type: 'consume',
    amount: actualCostCredits,
    direction: -1,
    job_id: jobId
  })

  const { data: finalAccount } = await supabaseClient
    .from('credit_accounts')
    .select('available, reserved, consumed')
    .eq('workspace_id', workspaceId)
    .single()

  if (finalAccount) {
    await supabaseClient.from('credit_accounts').update({
      reserved: Math.max(0, finalAccount.reserved - reservedCredits),
      available: finalAccount.available + (reservedCredits - actualCostCredits),
      consumed: finalAccount.consumed + actualCostCredits
    }).eq('workspace_id', workspaceId)
  }

  return actualCostCredits
}

// Refund a pending reservation after provider failure.
async function refundReservation(
  supabaseClient: any,
  workspaceId: string,
  accountData: { available: number; reserved: number },
  reservedCredits: number,
  jobId: string,
  errorMessage: string,
): Promise<void> {
  await supabaseClient.from('credit_accounts').update({
    available: accountData.available + reservedCredits,
    reserved: Math.max(0, (accountData.reserved || 0) - reservedCredits)
  }).eq('workspace_id', workspaceId)

  await supabaseClient.from('usage_jobs').update({
    status: 'failed',
    error_details: errorMessage,
    completed_at: new Date().toISOString()
  }).eq('id', jobId)
}

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
    const { prompt, workspace_id, action_type = 'chat', model_code = 'gemini-flash-latest', fallback_models, document_id = null, stream = false, context = null } = payload

    if (!prompt || !workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing prompt or workspace_id' }), { status: 400, headers: corsHeaders })
    }

    if (prompt.length < MIN_PROMPT_LENGTH || prompt.length > MAX_PROMPT_LENGTH) {
      return new Response(JSON.stringify({ error: `Prompt length must be between ${MIN_PROMPT_LENGTH} and ${MAX_PROMPT_LENGTH} characters` }), { status: 400, headers: corsHeaders })
    }

    // ==========================================
    // PLAN ENFORCEMENT: Fetch subscription
    // ==========================================
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('plan_code')
      .eq('workspace_id', workspace_id)
      .single()

    const planCode: string = subscription?.plan_code ?? 'free'

    // Define plan capabilities
    const PLAN_MODELS: Record<string, string[]> = {
      free: ['gemini-flash-latest'],
      pro: ['gemini-flash-latest', 'gemini-pro-latest'],
    }
    const PLAN_MONTHLY_CREDIT_QUOTA: Record<string, number> = {
      free: 50,
      pro: 1000,
    }

    const allowedModels = PLAN_MODELS[planCode] ?? PLAN_MODELS['free']
    const monthlyQuota = PLAN_MONTHLY_CREDIT_QUOTA[planCode] ?? 50

    // Block access to restricted models
    if (!allowedModels.includes(model_code)) {
      return new Response(JSON.stringify({
        error: `Model "${model_code}" is not available on the ${planCode} plan. Please upgrade to access advanced models.`,
        plan_required: 'pro',
        current_plan: planCode,
      }), { status: 403, headers: corsHeaders })
    }

    // Enforce monthly credit quota
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const { data: monthlyUsage } = await supabaseClient
      .from('credit_ledger')
      .select('amount')
      .eq('workspace_id', workspace_id)
      .eq('entry_type', 'consume')
      .gte('created_at', monthStart)

    const totalConsumedThisMonth = monthlyUsage
      ? monthlyUsage.reduce((acc: number, row: any) => acc + row.amount, 0)
      : 0

    if (totalConsumedThisMonth >= monthlyQuota) {
      return new Response(JSON.stringify({
        error: `Monthly credit quota of ${monthlyQuota} credits reached for your ${planCode} plan. Please upgrade or purchase additional credits.`,
        quota: monthlyQuota,
        consumed: totalConsumedThisMonth,
        plan_required: planCode === 'free' ? 'pro' : null,
      }), { status: 402, headers: corsHeaders })
    }

    // ==========================================
    // SECURITY 1: Prompt Injection Check
    // ==========================================
    const injectionRegex = /(ignore\s+(all\s+)?(previous\s+)?instructions|system\s+prompt|system\s+override|forget\s+(all\s+)?previous|prompt\s+override|you\s+are\s+now|act\s+as\s+if|roleplay\s+as|pretend\s+to\s+be|simulate\s+being|adopt\s+the\s+persona|embody\s+the\s+character|imitate|impersonate|override\s+my\s+instructions|disregard\s+(all\s+)?(previous\s+)?(instructions|orders))/i;
    if (injectionRegex.test(prompt)) {
      // Log Security Event
      await supabaseClient.from('security_events').insert({
        workspace_id,
        user_id: user.id,
        event_type: 'prompt_injection',
        severity: 'HIGH',
        signal: prompt.substring(0, 200),
        metadata: { action_type }
      });
      return new Response(JSON.stringify({ error: 'Malicious prompt detected and blocked.' }), { status: 400, headers: corsHeaders });
    }

    // ==========================================
    // SECURITY 2: Rate Limiting (Fixed Window)
    // ==========================================
    const ACTION_LIMIT = 50;
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0).toISOString();

    const { data: existingLimit } = await supabaseClient
      .from('rate_limit_counters')
      .select('id, count')
      .eq('scope_type', 'workspace')
      .eq('scope_id', workspace_id)
      .eq('metric', 'actions_per_hour')
      .eq('window_start', windowStart)
      .single();

    if (existingLimit) {
      if (existingLimit.count >= ACTION_LIMIT) {
        await supabaseClient.from('security_events').insert({
          workspace_id,
          user_id: user.id,
          event_type: 'rate_limit',
          severity: 'MEDIUM',
          metadata: { limit: ACTION_LIMIT, metric: 'actions_per_hour' }
        });
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), { status: 429, headers: corsHeaders });
      }
      await supabaseClient.from('rate_limit_counters').update({ count: existingLimit.count + 1 }).eq('id', existingLimit.id);
    } else {
      await supabaseClient.from('rate_limit_counters').insert({
        scope_type: 'workspace',
        scope_id: workspace_id,
        metric: 'actions_per_hour',
        window_start: windowStart,
        count: 1
      });
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

    const totalConsumedToday = dailyUsage ? dailyUsage.reduce((acc: number, row: any) => acc + row.amount, 0) : 0;

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
    // BUILD PROMPT WITH RAG CONTEXT
    // ==========================================
    function buildPromptWithRAG(userPrompt: string, ctx: any): string {
      if (!ctx?.ragChunks || !Array.isArray(ctx.ragChunks) || ctx.ragChunks.length === 0) {
        return userPrompt;
      }

      const ragContext = ctx.ragChunks
        .map((chunk: any, idx: number) => {
          const citeNum = idx + 1;
          return `[${citeNum}] Document: "${chunk.document_name || 'Unknown'}", Page ${chunk.page_number || '?'}: ${chunk.chunk_text?.substring(0, 500) || ''}`;
        })
        .join('\n\n');

      return `Answer the user's question using the following retrieved document chunks as context. Cite sources using bracketed numbers like [1], [2] that correspond to the chunks below.

RETRIEVED CONTEXT:
${ragContext}

USER QUESTION:
${userPrompt}

INSTRUCTIONS:
- Answer based on the retrieved context above
- Cite sources inline using [1], [2], etc. corresponding to the chunk numbers
- If the context doesn't contain enough information, say so
- Be concise but comprehensive`;
    }

    // ==========================================
    // ROUTING & EXECUTION
    // ==========================================

    // Build enhanced prompt with RAG context if available
    const enhancedPrompt = buildPromptWithRAG(prompt, context);

    const chain = fallback_models || [model_code, 'gemini-flash-latest']

    const { result, usedModel } = await router.routeWithFallback(
      chain,
      enhancedPrompt,
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
          reserved: (accountData.reserved || 0) + reservedCredits
        }).eq('workspace_id', workspace_id)

        await supabaseClient.from('credit_ledger').insert({
          workspace_id,
          entry_type: 'reserve',
          amount: reservedCredits,
          direction: -1,
          job_id: usageJob.id
        })

        // Streaming path: consume the provider's stream inside the SSE stream's own
        // lifecycle so credits are settled exactly once for the whole generation.
        // Running everything in start() keeps the work tied to the Response itself,
        // which survives after the handler returns (unlike detached background tasks).
        if (stream && provider.generateStream) {
          const encoder = new TextEncoder()
          let clientAborted = false

          const sseResponse = new Response(new ReadableStream({
            async start(controller) {
              let accumulatedText = ''
              let finalUsage: { inputTokens: number; outputTokens: number } | null = null

              const send = (data: object) => {
                if (!clientAborted) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
                }
              }

              try {
                send({ type: 'start', model: currentModelCode })

                for await (const chunk of provider.generateStream!(currentModelCode, enhancedPrompt)) {
                  if (chunk.text) {
                    accumulatedText += chunk.text
                    send({ chunk: chunk.text })
                  }
                  if (chunk.done && chunk.usage) {
                    finalUsage = chunk.usage
                  }
                }

                const inputTokens = finalUsage?.inputTokens ?? estimatedInputTokens
                const outputTokens = finalUsage?.outputTokens ?? Math.max(1, Math.ceil(accumulatedText.length / 4))
                const actualCostCredits = await settleCredits(supabaseClient, workspace_id, pricing, reservedCredits, inputTokens, outputTokens, usageJob.id)

                send({ usage: { inputTokens, outputTokens, costCredits: actualCostCredits }, done: true })
                console.log(`Streaming job ${usageJob.id} completed. Cost: ${actualCostCredits} credits.`)
              } catch (llmError: any) {
                await refundReservation(supabaseClient, workspace_id, accountData, reservedCredits, usageJob.id, llmError.message)
                send({ error: llmError.message, done: true })
              } finally {
                try { controller.close() } catch { /* already closed */ }
              }
            },
            cancel() {
              clientAborted = true
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
          })

          return {
            sseResponse,
            text: '',
            usage: { inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens },
          } as any
        }

        let providerResult;
        try {
          providerResult = await withTimeout(provider.generate(currentModelCode, enhancedPrompt), PROVIDER_TIMEOUT_MS, `Provider ${currentModelCode}`)
        } catch (llmError: any) {
          await refundReservation(supabaseClient, workspace_id, accountData, reservedCredits, usageJob.id, llmError.message)
          throw llmError
        }

        const inputTokens = providerResult.usage.inputTokens
        const outputTokens = providerResult.usage.outputTokens
        const actualCostCredits = await settleCredits(supabaseClient, workspace_id, pricing, reservedCredits, inputTokens, outputTokens, usageJob.id)

        return {
          text: providerResult.text,
          usage: { inputTokens, outputTokens, costCredits: actualCostCredits }
        }
      }
    )

    // Return streaming response if the callback produced an SSE response
    if ((result as any)?.sseResponse) {
      return (result as any).sseResponse
    }

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