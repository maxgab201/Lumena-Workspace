/**
 * Free-plan quota bookkeeping for the AI gateway, kept free of Deno/URL imports so vitest can
 * exercise it. The gateway consumes one unit of the daily quota BEFORE it calls a provider; this
 * gives the unit back when the request ends without the user getting an answer.
 */

// deno-lint-ignore no-explicit-any
type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> | any }

/** The UTC day the quota counts against (consume_ai_request uses `now() at time zone 'utc'`). */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Returns a function that refunds the unit taken for this request, at most once. It never throws:
 * a failed refund is logged and the user simply keeps the cost they already had, which must not
 * turn an error response into a different error.
 */
export function createQuotaRefund(client: RpcClient, workspaceId: string, day: string = utcDay()) {
  let done = false
  return async (): Promise<void> => {
    if (done) return
    done = true
    try {
      const { error } = await client.rpc('refund_ai_request', { p_workspace_id: workspaceId, p_day: day })
      if (error) console.warn(`[quota] refund for ${workspaceId} failed (non-fatal): ${error.message}`)
    } catch (err) {
      console.warn(`[quota] refund for ${workspaceId} threw (non-fatal):`, err)
    }
  }
}
