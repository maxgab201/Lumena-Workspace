/**
 * ChatAction — Handles chat completion requests.
 *
 * Extracted from the original ai-gateway/index.ts.
 * Preserves all existing behavior: plan enforcement, billing, provider routing.
 */

import type { AIActionRequest, AIActionResponse, ActionContext, ActionHandler } from "../types.ts"
import { ProviderRouter } from "../router.ts"
import type { AIProvider } from "../providers/Provider.ts"

const router = new ProviderRouter()

// Plan model allowlists (existing behavior)
const PLAN_MODELS: Record<string, string[]> = {
  free: [],
  pro: [],
}

export class ChatAction implements ActionHandler {
  validate(request: AIActionRequest): string | null {
    if (!request.prompt) return "Missing 'prompt' field"
    if (!request.model_code && !request.fallback_models?.length) {
      return "Missing 'model_code' or 'fallback_models'"
    }
    return null
  }

  authPolicy(): 'user' | 'system' {
    return 'user'  // Chat is user-initiated: plan enforcement + credits
  }

  async execute(request: AIActionRequest, context: ActionContext): Promise<AIActionResponse> {
    const { supabase, workspaceId, documentId, userId } = context
    const { prompt, model_code = "", fallback_models, action_type, document_id } = request

    // Get plan for model enforcement
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_code")
      .eq("workspace_id", workspaceId)
      .single()

    const planCode: string = subscription?.plan_code ?? "free"
    const allowedModels = PLAN_MODELS[planCode] ?? PLAN_MODELS["free"]

    // Block restricted models (existing behavior)
    if (!allowedModels.includes(model_code)) {
      return {
        success: false,
        data: {
          error: `Model "${model_code}" is not available on the ${planCode} plan.`,
          plan_required: "pro",
          current_plan: planCode,
        },
      }
    }

    // Route through provider fallback chain
    const chain = fallback_models || [model_code, "gemini-1.5-flash"]

    const { result, usedModel } = await router.routeWithFallback(
      chain,
      prompt!,
      async (currentModelCode: string, provider: AIProvider) => {
        // Fetch model pricing
        const { data: modelData, error: modelError } = await supabase
          .from("provider_models")
          .select("id, provider_id, max_output_tokens, provider_pricing(input_price_per_1k, output_price_per_1k, credit_conversion_rate)")
          .eq("code", currentModelCode)
          .eq("is_active", true)
          .single()

        if (modelError || !modelData || !modelData.provider_pricing || modelData.provider_pricing.length === 0) {
          throw new Error(`Model ${currentModelCode} not found or inactive`)
        }

        const pricing = modelData.provider_pricing[0]

        // Estimate costs
        const estimatedInputTokens = Math.max(10, Math.ceil(prompt!.length / 4))
        const estimatedOutputTokens = 1000
        const estimatedInputCostUsd = (estimatedInputTokens / 1000) * pricing.input_price_per_1k
        const estimatedOutputCostUsd = (estimatedOutputTokens / 1000) * pricing.output_price_per_1k
        const totalEstimatedUsd = estimatedInputCostUsd + estimatedOutputCostUsd
        const reservedCredits = Math.max(1, Math.ceil(totalEstimatedUsd * pricing.credit_conversion_rate))

        // Check credit balance
        const { data: accountData } = await supabase
          .from("credit_accounts")
          .select("available, reserved")
          .eq("workspace_id", workspaceId)
          .single()

        if (!accountData || accountData.available < reservedCredits) {
          const err = new Error("Insufficient credits") as Error & { status: number; required: number; available: number }
          err.status = 402
          err.required = reservedCredits
          err.available = accountData?.available || 0
          throw err
        }

        // Create usage job
        const { data: usageJob, error: jobError } = await supabase
          .from("usage_jobs")
          .insert({
            workspace_id: workspaceId,
            document_id: documentId ?? document_id,
            action_type,
            model_id: modelData.id,
            status: "pending",
          })
          .select("id")
          .single()

        if (jobError) throw new Error("Failed to create usage job")

        // Optimistic lock credit deduction
        const { error: deductError } = await supabase
          .from("credit_accounts")
          .update({
            available: accountData.available - reservedCredits,
            reserved: accountData.reserved + reservedCredits,
          })
          .eq("workspace_id", workspaceId)
          .eq("available", accountData.available)

        if (deductError) {
          throw Object.assign(new Error("Credit deduction failed"), { status: 409 })
        }

        // Execute LLM call
        let providerResult
        try {
          providerResult = await provider.generate(currentModelCode, prompt!)
        } catch (llmError: unknown) {
          // Rollback credits
          await supabase.from("credit_accounts").update({
            available: accountData.available,
            reserved: accountData.reserved,
          }).eq("workspace_id", workspaceId)

          const msg = llmError instanceof Error ? llmError.message : String(llmError)
          await supabase.from("usage_jobs").update({
            status: "failed",
            error_details: msg,
            completed_at: new Date().toISOString(),
          }).eq("id", usageJob.id)

          throw llmError
        }

        // Calculate actual costs
        const inputTokens = providerResult.usage.inputTokens
        const outputTokens = providerResult.usage.outputTokens
        const actualInputCostUsd = (inputTokens / 1000) * pricing.input_price_per_1k
        const actualOutputCostUsd = (outputTokens / 1000) * pricing.output_price_per_1k
        const totalActualUsd = actualInputCostUsd + actualOutputCostUsd
        const actualCostCredits = Math.max(1, Math.ceil(totalActualUsd * pricing.credit_conversion_rate))

        // Update usage job
        await supabase.from("usage_jobs").update({
          status: "success",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_cost_credits: actualCostCredits,
          completed_at: new Date().toISOString(),
        }).eq("id", usageJob.id)

        // Record consumption
        await supabase.from("credit_ledger").insert({
          workspace_id: workspaceId,
          entry_type: "consume",
          amount: actualCostCredits,
          direction: -1,
          job_id: usageJob.id,
        })

        // Settle credits
        const { data: finalAccount } = await supabase
          .from("credit_accounts")
          .select("available, reserved, consumed")
          .eq("workspace_id", workspaceId)
          .single()

        if (finalAccount) {
          await supabase.from("credit_accounts").update({
            reserved: Math.max(0, finalAccount.reserved - reservedCredits),
            available: finalAccount.available + (reservedCredits - actualCostCredits),
            consumed: finalAccount.consumed + actualCostCredits,
          }).eq("workspace_id", workspaceId)
        }

        return {
          text: providerResult.text,
          usage: { inputTokens, outputTokens, costCredits: actualCostCredits },
        }
      },
    )

    return {
      success: true,
      data: { text: result.text },
      usage: result.usage,
      model: usedModel,
    }
  }
}
