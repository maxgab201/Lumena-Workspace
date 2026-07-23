/**
 * Common types for the AI Gateway action system.
 *
 * Every action (chat, embedding, reranking, etc.) follows
 * the same request/response contract.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

/** Request payload from client */
export interface AIActionRequest {
  action_type: string
  workspace_id: string
  document_id?: string | null
  user_id: string
  job_id?: string | null  // for system-initiated actions

  // Chat-specific
  prompt?: string
  model_code?: string
  fallback_models?: string[]

  // Embedding-specific
  texts?: string[]

  // Generic
  metadata?: Record<string, unknown>
}

/** Response from action handler */
export interface AIActionResponse {
  success: boolean
  data: unknown
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    costCredits?: number
  }
  model?: string
}

/** Action handler context — shared across all actions */
export interface ActionContext {
  supabase: SupabaseClient
  workspaceId: string
  documentId: string | null
  userId: string
  jobId: string | null
  isSystemInitiated: boolean  // true if called by another service, not user
}

/** Action handler interface */
export interface ActionHandler {
  /** Validate action-specific fields */
  validate(request: AIActionRequest): string | null  // null = valid, string = error

  /** Execute the action */
  execute(request: AIActionRequest, context: ActionContext): Promise<AIActionResponse>

  /** Whether this action requires plan enforcement */
  requiresPlanEnforcement(): boolean

  /** Whether this action consumes credits */
  consumesCredits(): boolean
}
