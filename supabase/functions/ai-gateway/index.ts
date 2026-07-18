import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.2.1"

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user authorization (extract token from headers)
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
    const { prompt, workspace_id, action_type = 'chat', model_code = 'gemini-1.5-flash', document_id = null } = payload

    if (!prompt || !workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing prompt or workspace_id' }), { status: 400, headers: corsHeaders })
    }

    // 1. Fetch Model and Pricing
    const { data: modelData, error: modelError } = await supabaseClient
      .from('provider_models')
      .select('id, provider_id, max_output_tokens, provider_pricing(input_price_per_1k, output_price_per_1k, credit_conversion_rate)')
      .eq('code', model_code)
      .eq('is_active', true)
      .single()

    if (modelError || !modelData || !modelData.provider_pricing || modelData.provider_pricing.length === 0) {
      return new Response(JSON.stringify({ error: 'Model not found or inactive' }), { status: 400, headers: corsHeaders })
    }

    const pricing = modelData.provider_pricing[0]
    
    // 2. Estimate Cost and Check Credits
    // Rough estimate: 1 token ~ 4 chars. Max output tokens from model config.
    const estimatedInputTokens = Math.max(10, Math.ceil(prompt.length / 4))
    const estimatedOutputTokens = 1000 // A reasonable reserve for standard chat

    const estimatedInputCostUsd = (estimatedInputTokens / 1000) * pricing.input_price_per_1k
    const estimatedOutputCostUsd = (estimatedOutputTokens / 1000) * pricing.output_price_per_1k
    const totalEstimatedUsd = estimatedInputCostUsd + estimatedOutputCostUsd
    
    // Convert to credits (e.g. $0.01 = 1 credit if rate is 100)
    // We always reserve a minimum of 1 credit
    const reservedCredits = Math.max(1, Math.ceil(totalEstimatedUsd * pricing.credit_conversion_rate))

    const { data: accountData } = await supabaseClient
      .from('credit_accounts')
      .select('available, reserved')
      .eq('workspace_id', workspace_id)
      .single()

    if (!accountData || accountData.available < reservedCredits) {
      return new Response(JSON.stringify({ error: 'Insufficient credits', required: reservedCredits, available: accountData?.available || 0 }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Insert Usage Job (Pending)
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

    // Reserve Credits
    await supabaseClient.from('credit_accounts').update({
      available: accountData.available - reservedCredits,
      reserved: accountData.reserved + reservedCredits
    }).eq('workspace_id', workspace_id)

    // 3. Execute LLM Call (Google Gemini)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) throw new Error('Server configuration error: GEMINI_API_KEY not set')

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: model_code })

    let llmResponseText = ''
    let inputTokens = 0
    let outputTokens = 0

    try {
      const result = await model.generateContent(prompt)
      const response = await result.response
      llmResponseText = response.text()
      
      // Parse usage metadata if available (Gemini SDK sometimes provides it on response)
      // Note: usageMetadata is available on Gemini responses in recent SDKs
      if (response.usageMetadata) {
        inputTokens = response.usageMetadata.promptTokenCount || estimatedInputTokens
        outputTokens = response.usageMetadata.candidatesTokenCount || 0
      } else {
        inputTokens = estimatedInputTokens
        outputTokens = Math.max(1, Math.ceil(llmResponseText.length / 4))
      }
    } catch (llmError: any) {
      // Refund reserved credits
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

    // 4. Calculate Actual Cost & Settle
    const actualInputCostUsd = (inputTokens / 1000) * pricing.input_price_per_1k
    const actualOutputCostUsd = (outputTokens / 1000) * pricing.output_price_per_1k
    const totalActualUsd = actualInputCostUsd + actualOutputCostUsd
    
    // Minimum 1 credit per successful action
    const actualCostCredits = Math.max(1, Math.ceil(totalActualUsd * pricing.credit_conversion_rate))

    // Update Usage Job
    await supabaseClient.from('usage_jobs').update({
      status: 'success',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_cost_credits: actualCostCredits,
      completed_at: new Date().toISOString()
    }).eq('id', usageJob.id)

    // Ledger Entry (Consume)
    await supabaseClient.from('credit_ledger').insert({
      workspace_id,
      entry_type: 'consume',
      amount: actualCostCredits,
      direction: -1,
      job_id: usageJob.id
    })

    // Finalize Account Balances (Refund unused reservation)
    const { data: finalAccount } = await supabaseClient
      .from('credit_accounts')
      .select('available, reserved, consumed')
      .eq('workspace_id', workspace_id)
      .single()

    if (finalAccount) {
      await supabaseClient.from('credit_accounts').update({
        reserved: Math.max(0, finalAccount.reserved - reservedCredits),
        available: finalAccount.available + (reservedCredits - actualCostCredits), // refund difference
        consumed: finalAccount.consumed + actualCostCredits
      }).eq('workspace_id', workspace_id)
    }

    // 5. Return Response
    return new Response(JSON.stringify({ 
      text: llmResponseText,
      usage: { inputTokens, outputTokens, costCredits: actualCostCredits }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error('AI Gateway error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
