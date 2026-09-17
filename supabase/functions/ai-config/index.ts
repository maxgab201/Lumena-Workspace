import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { getCatalog, tierOf, resolvePlan, FREE_DAILY_LIMIT, quotaInfo } from "../_shared/modelCatalog.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const url = new URL(req.url)
    const workspaceId = url.searchParams.get('workspace_id') ?? url.searchParams.get('id')
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Membership check (same guard as ai-highlight / ai-gateway)
    const { data: membership } = await supabaseClient
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const [catalog, plan] = await Promise.all([
      getCatalog(),
      resolvePlan(supabaseClient, workspaceId),
    ])

    // Quota for free (read-only; server-side enforce happens in ai-gateway / ai-highlight)
    let quota = { used: 0, limit: FREE_DAILY_LIMIT, resets_at: quotaInfo(0).resets_at }
    if (plan === 'free') {
      const { data: usageRow } = await supabaseClient
        .from('ai_daily_usage')
        .select('chat_count, highlight_count')
        .eq('workspace_id', workspaceId)
        .eq('day', new Date().toISOString().slice(0, 10))
        .single()
      if (usageRow) {
        const used = (usageRow.chat_count || 0) + (usageRow.highlight_count || 0)
        quota = { used, limit: FREE_DAILY_LIMIT, resets_at: quotaInfo(used).resets_at }
      }
    }

    const modelsForPlan = catalog.map((m) => ({
      ...m,
      locked: plan === 'free' && m.tier === 'pro',
      freeBadge: m.tier === 'free',
      proBadge: m.tier === 'pro',
    }))

    const freeModels = modelsForPlan.filter((m) => m.tier === 'free')

    return new Response(JSON.stringify({
      plan,
      quota,
      models: modelsForPlan,
      free_default_chat: DEFAULT_CHAT_FREE_MODEL,
      free_default_highlight: DEFAULT_HIGHLIGHT_FREE_MODEL,
      free_models: freeModels.map((m) => m.model_id),
      request_id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal error', request_id: crypto?.randomUUID?.() || 'unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
