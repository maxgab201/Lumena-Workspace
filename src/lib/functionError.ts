export interface FunctionErrorDetails {
  /** What the function said ({"error": "..."}), or the client's own message when it said nothing usable. */
  message: string;
  /** Machine-readable reason some functions add ({"code": "stripe_not_configured"}). */
  code?: string;
  status?: number;
}

/**
 * supabase-js reports ANY non-2xx answer of an Edge Function as a FunctionsHttpError whose message is always
 * "Edge Function returned a non-2xx status code". What the function actually said is only in `error.context`, a
 * Response nobody has read. This reads it (from a clone, so the body stays readable for anyone else) and falls
 * back to the error's own message when there is no response or it is not the JSON these functions answer with.
 */
export async function readFunctionError(error: unknown): Promise<FunctionErrorDetails> {
  const fallback = error instanceof Error && error.message ? error.message : 'Unexpected error';
  const context = (error as { context?: unknown } | null | undefined)?.context;

  if (typeof Response !== 'undefined' && context instanceof Response) {
    let body: { error?: unknown; code?: unknown } | undefined;
    try {
      body = await context.clone().json();
    } catch {
      body = undefined;
    }
    return {
      message: typeof body?.error === 'string' && body.error ? body.error : fallback,
      code: typeof body?.code === 'string' ? body.code : undefined,
      status: context.status,
    };
  }

  return { message: fallback };
}
