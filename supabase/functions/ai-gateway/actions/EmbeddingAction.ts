/**
 * EmbeddingAction — Handles text embedding requests.
 *
 * Calls OpenAI text-embedding-3-small API directly.
 * Used by EmbeddingService for document chunk embedding.
 */

import type { AIActionRequest, AIActionResponse, ActionContext, ActionHandler } from "../types.ts"

const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings"
const EMBEDDING_MODEL = "text-embedding-3-small"
const EMBEDDING_DIMENSIONS = 1536

export class EmbeddingAction implements ActionHandler {
  validate(request: AIActionRequest): string | null {
    if (!request.texts || !Array.isArray(request.texts) || request.texts.length === 0) {
      return "Missing or empty 'texts' array"
    }
    if (request.texts.length > 2048) {
      return "Batch size exceeds maximum of 2048 texts"
    }
    return null
  }

  requiresPlanEnforcement(): boolean {
    return false  // Internal service — no plan restrictions
  }

  consumesCredits(): boolean {
    return true  // Embeddings cost tokens
  }

  async execute(request: AIActionRequest, context: ActionContext): Promise<AIActionResponse> {
    const { supabase, workspaceId, documentId, jobId, isSystemInitiated } = context
    const { texts, action_type, document_id } = request

    const openaiKey = Deno.env.get("OPENAI_API_KEY")
    if (!openaiKey) {
      return { success: false, data: { error: "OPENAI_API_KEY not configured" } }
    }

    // Estimate token count (rough: 1 token ≈ 4 chars for English)
    const totalChars = texts!.reduce((sum, t) => sum + t.length, 0)
    const estimatedTokens = Math.ceil(totalChars / 4)

    // Fetch embedding model pricing
    const { data: modelData } = await supabase
      .from("provider_models")
      .select("id, provider_pricing(input_price_per_1k, credit_conversion_rate)")
      .eq("code", EMBEDDING_MODEL)
      .eq("is_active", true)
      .single()

    const pricing = modelData?.provider_pricing?.[0]
    const costPer1k = pricing?.input_price_per_1k ?? 0.02
    const creditRate = pricing?.credit_conversion_rate ?? 100

    const estimatedCostUsd = (estimatedTokens / 1000) * costPer1k
    const reservedCredits = Math.max(1, Math.ceil(estimatedCostUsd * creditRate))

    // Check credits (skip for system-initiated if no workspace)
    if (!isSystemInitiated || workspaceId) {
      const { data: accountData } = await supabase
        .from("credit_accounts")
        .select("available, reserved")
        .eq("workspace_id", workspaceId)
        .single()

      if (!accountData || accountData.available < reservedCredits) {
        return {
          success: false,
          data: {
            error: "Insufficient credits for embedding",
            required: reservedCredits,
            available: accountData?.available ?? 0,
          },
        }
      }

      // Reserve credits
      await supabase.from("credit_accounts").update({
        available: accountData.available - reservedCredits,
        reserved: accountData.reserved + reservedCredits,
      }).eq("workspace_id", workspaceId)
    }

    // Create usage job
    let usageJobId: string | null = null
    if (modelData) {
      const { data: usageJob } = await supabase
        .from("usage_jobs")
        .insert({
          workspace_id: workspaceId || "system",
          document_id: documentId ?? null,
          action_type,
          model_id: modelData.id,
          status: "pending",
        })
        .select("id")
        .single()
      usageJobId = usageJob?.id ?? null
    }

    // Call OpenAI Embedding API
    try {
      const response = await fetch(OPENAI_EMBEDDING_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: texts,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`OpenAI API error: ${response.status} ${errorBody}`)
      }

      const result = await response.json()
      const embeddings = result.data.map((item: { embedding: number[] }) => item.embedding)
      const actualTokens = result.usage?.total_tokens ?? estimatedTokens
      const actualCostUsd = (actualTokens / 1000) * costPer1k
      const actualCostCredits = Math.max(1, Math.ceil(actualCostUsd * creditRate))

      // Update usage job
      if (usageJobId) {
        await supabase.from("usage_jobs").update({
          status: "success",
          input_tokens: actualTokens,
          total_cost_credits: actualCostCredits,
          completed_at: new Date().toISOString(),
        }).eq("id", usageJobId)

        // Record consumption
        await supabase.from("credit_ledger").insert({
          workspace_id: workspaceId || "system",
          entry_type: "consume",
          amount: actualCostCredits,
          direction: -1,
          job_id: usageJobId,
        })
      }

      // Settle credits
      if (workspaceId) {
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
      }

      return {
        success: true,
        data: { embeddings },
        usage: { totalTokens: actualTokens, costCredits: actualCostCredits },
        model: EMBEDDING_MODEL,
      }
    } catch (error) {
      // Rollback credits on failure
      if (workspaceId) {
        const { data: rollback } = await supabase
          .from("credit_accounts")
          .select("available, reserved")
          .eq("workspace_id", workspaceId)
          .single()
        if (rollback) {
          await supabase.from("credit_accounts").update({
            available: rollback.available + reservedCredits,
            reserved: Math.max(0, rollback.reserved - reservedCredits),
          }).eq("workspace_id", workspaceId)
        }
      }

      if (usageJobId) {
        const msg = error instanceof Error ? error.message : String(error)
        await supabase.from("usage_jobs").update({
          status: "failed",
          error_details: msg,
          completed_at: new Date().toISOString(),
        }).eq("id", usageJobId)
      }

      throw error
    }
  }
}
