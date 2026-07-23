/**
 * AI Gateway — Unified entry point for all AI operations.
 *
 * Architecture:
 * - Action Router dispatches to action-specific handlers
 * - Shared auth/authz pipeline for all actions
 * - Billing differentiates user vs system actions
 * - Common contract: AIActionRequest → AIActionResponse
 *
 * Actions:
 * - chat: LLM text generation (user-initiated)
 * - embedding: Text embedding generation (system-initiated)
 * - Future: reranking, extraction, classification, etc.
 */

import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import type { AIActionRequest, AIActionResponse, ActionContext, ActionHandler } from "./types.ts"
import { ChatAction } from "./actions/ChatAction.ts"
import { EmbeddingAction } from "./actions/EmbeddingAction.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Action Registry ─────────────────────────────────────────

const actions: Record<string, ActionHandler> = {
  chat: new ChatAction(),
  embedding: new EmbeddingAction(),
  // Future: reranking, extraction, classification, etc.
}

// ─── Shared Security Pipeline ────────────────────────────────

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  userId: string,
): Promise<{ allowed: boolean; error?: Response }> {
  const ACTION_LIMIT = 50
  const now = new Date()
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0).toISOString()

  let currentCount = 0
  const { data: existing } = await supabase
    .from('rate_limit_counters')
    .select('id, count')
    .eq('scope_type', 'workspace')
    .eq('scope_id', workspaceId)
    .eq('metric', 'actions_per_hour')
    .eq('window_start', windowStart)
    .single()

  if (existing) {
    currentCount = existing.count + 1
    await supabase.from('rate_limit_counters').update({ count: currentCount }).eq('id', existing.id)
  } else {
    currentCount = 1
    await supabase.from('rate_limit_counters').insert({
      scope_type: 'workspace',
      scope_id: workspaceId,
      metric: 'actions_per_hour',
      window_start: windowStart,
      count: currentCount,
    })
  }

  if (currentCount > ACTION_LIMIT) {
    await supabase.from('security_events').insert({
      workspace_id: workspaceId,
      user_id: userId,
      event_type: 'rate_limit',
      severity: 'MEDIUM',
      metadata: { limit: ACTION_LIMIT, metric: 'actions_per_hour' },
    })
    return {
      allowed: false,
      error: new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  return { allowed: true }
}

async function checkCircuitBreaker(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  userId: string,
): Promise<{ allowed: boolean; error?: Response }> {
  const DAILY_CAP = 10000
  const dayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0).toISOString()

  const { data: dailyUsage } = await supabase
    .from('credit_ledger')
    .select('amount')
    .eq('workspace_id', workspaceId)
    .eq('entry_type', 'consume')
    .gte('created_at', dayStart)

  const total = dailyUsage ? dailyUsage.reduce((acc: number, row: { amount: number }) => acc + row.amount, 0) : 0

  if (total > DAILY_CAP) {
    await supabase.from('security_events').insert({
      workspace_id: workspaceId,
      user_id: userId,
      event_type: 'circuit_breaker',
      severity: 'HIGH',
      metadata: { cap: DAILY_CAP, consumed: total },
    })
    return {
      allowed: false,
      error: new Response(JSON.stringify({ error: 'Daily credit cap reached.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  return { allowed: true }
}

async function checkPromptInjection(
  prompt: string,
  workspaceId: string,
  userId: string,
  actionType: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ safe: boolean; error?: Response }> {
  const injectionRegex = /(ignore\s+(all\s+)?(previous\s+)?instructions|system\s+prompt|system\s+override|forget\s+(all\s+)?previous)/i
  if (injectionRegex.test(prompt)) {
    await supabase.from('security_events').insert({
      workspace_id: workspaceId,
      user_id: userId,
      event_type: 'prompt_injection',
      severity: 'HIGH',
      signal: prompt.substring(0, 200),
      metadata: { action_type: actionType },
    })
    return {
      safe: false,
      error: new Response(JSON.stringify({ error: 'Malicious prompt detected.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }
  return { safe: true }
}

// ─── Main Handler ────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ─── Authentication ───
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Parse Request ───
    const payload = await req.json()
    const actionType: string = payload.action_type ?? 'chat'

    const request: AIActionRequest = {
      action_type: actionType,
      workspace_id: payload.workspace_id,
      document_id: payload.document_id ?? null,
      user_id: user.id,
      job_id: payload.job_id ?? null,
      prompt: payload.prompt,
      model_code: payload.model_code,
      fallback_models: payload.fallback_models,
      texts: payload.texts,
      metadata: payload.metadata,
    }

    // Validate workspace_id
    if (!request.workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Resolve Action Handler ───
    const handler = actions[actionType]
    if (!handler) {
      return new Response(JSON.stringify({ error: `Unknown action_type: ${actionType}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Action-Specific Validation ───
    const validationError = handler.validate(request)
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Determine if system-initiated ───
    // System actions: embedding, reranking, extraction (no user interaction)
    // User actions: chat, classification (user-initiated)
    const systemActions = ['embedding', 'reranking', 'extraction']
    const isSystemInitiated = systemActions.includes(actionType)

    // ─── Build Action Context ───
    const context: ActionContext = {
      supabase,
      workspaceId: request.workspace_id,
      documentId: request.document_id,
      userId: user.id,
      jobId: request.job_id,
      isSystemInitiated,
    }

    // ─── Shared Security Pipeline ───
    // Rate limiting (all actions)
    const rateLimit = await checkRateLimit(supabase, request.workspace_id, user.id)
    if (!rateLimit.allowed) return rateLimit.error!

    // Circuit breaker (all actions)
    const circuitBreaker = await checkCircuitBreaker(supabase, request.workspace_id, user.id)
    if (!circuitBreaker.allowed) return circuitBreaker.error!

    // Prompt injection (only for actions with prompts)
    if (request.prompt) {
      const injectionCheck = await checkPromptInjection(
        request.prompt, request.workspace_id, user.id, actionType, supabase,
      )
      if (!injectionCheck.safe) return injectionCheck.error!
    }

    // ─── Execute Action ───
    const result = await handler.execute(request, context)

    // ─── Return Response ───
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400,
    })

  } catch (err: unknown) {
    console.error('AI Gateway error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = (err as Record<string, unknown>).status as number ?? 500

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
