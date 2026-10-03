/**
 * Embedding-provider failure handling shared by process-document and rag-retrieve, kept free of
 * Deno/URL imports so vitest can exercise it.
 *
 * Embeddings are the AI layer: reading, OCR, text search, highlights and navigation must never
 * depend on them. What this module adds is how to behave when the provider says no:
 *  - tell "slow down" (per-minute) from "done for today" (per-day) and from "credentials/billing";
 *  - retry only what a retry can fix, a bounded number of times, honouring the provider's delay;
 *  - stop asking altogether once a request cannot succeed (a daily quota that is used up would
 *    otherwise be hit once per chunk: 457 requests for a 457-chunk document);
 *  - say clearly what happened, in a message the document can carry.
 */

export type EmbeddingFailureKind =
  | 'rate_limit'    // per-minute / burst limit: a retry after a pause can work
  | 'daily_quota'   // per-day quota used up: nothing works until it resets
  | 'auth'          // key rejected / billing not enabled: nothing works until someone fixes it
  | 'invalid_input' // this chunk is the problem, not the provider
  | 'transient';    // 5xx / network

export interface EmbeddingFailure {
  kind: EmbeddingFailureKind;
  status: number;
  /** How long the provider asked us to wait, when it said. */
  retryAfterMs: number | null;
  /** Short provider message, safe to log. */
  detail: string;
  /** Which quota the provider says was hit, e.g. "EmbedContentRequestsPerMinute...-FreeTier=100". */
  quota?: string | null;
}

export class EmbeddingHttpError extends Error {
  readonly failure: EmbeddingFailure;
  constructor(failure: EmbeddingFailure) {
    super(`Embedding failed (${failure.status}): ${failure.detail}`);
    this.name = 'EmbeddingHttpError';
    this.failure = failure;
  }
}

/** "37s", "1.5s", "250ms" (Google's RetryInfo.retryDelay) to milliseconds. */
export function parseRetryDelayMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  return Math.round(match[2].toLowerCase() === 'ms' ? amount : amount * 1000);
}

// deno-lint-ignore no-explicit-any
type Json = any;

function parseJson(body: string): Json | null {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/** Turns an HTTP failure from the embedding provider into something the pipeline can act on. */
export function classifyEmbeddingFailure(status: number, body: string): EmbeddingFailure {
  const json = parseJson(body);
  const message = typeof json?.error?.message === 'string' ? json.error.message : body;
  const detail = String(message).replace(/\s+/g, ' ').trim().slice(0, 160);
  // deno-lint-ignore no-explicit-any
  const details: any[] = Array.isArray(json?.error?.details) ? json.error.details : [];

  const retryInfo = details.find((entry) => typeof entry?.retryDelay === 'string');
  const retryAfterMs = parseRetryDelayMs(retryInfo?.retryDelay);

  if (status === 429) {
    const violations = details.flatMap((entry) => (Array.isArray(entry?.violations) ? entry.violations : []));
    const perDay = violations.some((violation: Json) => /perday|per_day|daily/i.test(String(violation?.quotaId ?? violation?.quotaMetric ?? '')));
    const first = violations[0];
    const quota = first ? `${first.quotaId ?? first.quotaMetric ?? 'unknown'}${first.quotaValue ? `=${first.quotaValue}` : ''}` : null;
    return { kind: perDay ? 'daily_quota' : 'rate_limit', status, retryAfterMs, detail, quota };
  }
  if (status === 401 || status === 403) return { kind: 'auth', status, retryAfterMs: null, detail };
  if (status === 400 || status === 404 || status === 413 || status === 422) {
    return { kind: 'invalid_input', status, retryAfterMs: null, detail };
  }
  return { kind: 'transient', status, retryAfterMs, detail };
}

export interface RetryOptions {
  maxAttempts?: number;
  /**
   * A provider delay longer than this is not waited out inside one Edge Function invocation. Pass a function
   * when the allowance shrinks with time (a stage budget): it is read before every wait, because a chunk that
   * has been retrying for a while must not keep believing in the allowance it had when it started.
   */
  maxInlineWaitMs?: number | (() => number);
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** Awaited before every attempt (a shared cooldown, so parallel workers do not each hit the limit). */
  beforeAttempt?: () => Promise<void>;
  /** When set, the wait is handed here (it starts the shared cooldown) instead of being slept in place. */
  onWait?: (ms: number) => void;
  /** Called for every failed attempt, retried or not (to log what the provider actually said). */
  onFailure?: (failure: EmbeddingFailure, attempt: number) => void;
}

/** What to wait before the next attempt, or null when waiting is pointless or too long. */
export function nextRetryDelayMs(failure: EmbeddingFailure, attempt: number, options: RetryOptions = {}): number | null {
  const { random = Math.random } = options;
  const maxInlineWaitMs = typeof options.maxInlineWaitMs === 'function' ? options.maxInlineWaitMs() : (options.maxInlineWaitMs ?? 10_000);
  if (failure.kind !== 'rate_limit' && failure.kind !== 'transient') return null;
  if (failure.retryAfterMs !== null) {
    return failure.retryAfterMs <= maxInlineWaitMs ? failure.retryAfterMs + Math.round(random() * 250) : null;
  }
  // No delay from the provider. A rate limit is a per-minute window, so it needs seconds to clear;
  // a transient error is worth a quick retry.
  const baseDelayMs = options.baseDelayMs ?? (failure.kind === 'rate_limit' ? 5_000 : 800);
  const exponential = baseDelayMs * 2 ** (attempt - 1);
  const wait = exponential + Math.round(random() * baseDelayMs);
  if (wait <= maxInlineWaitMs) return wait;
  // Not enough budget for the full backoff: use what is left, unless that is less than one base step.
  return maxInlineWaitMs >= baseDelayMs ? maxInlineWaitMs : null;
}

function failureOf(error: unknown): EmbeddingFailure {
  if (error instanceof EmbeddingHttpError) return error.failure;
  return { kind: 'transient', status: 0, retryAfterMs: null, detail: error instanceof Error ? error.message.slice(0, 160) : 'network error' };
}

/**
 * Runs one embedding request, retrying a rate limit or a transient error a bounded number of
 * times. Anything a retry cannot fix (daily quota, credentials, bad input), or a provider delay too
 * long to wait for, fails at once so the caller can stop instead of burning more requests.
 */
export async function embedWithRetry<T>(call: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) } = options;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await options.beforeAttempt?.();
      return await call();
    } catch (error) {
      lastError = error;
      options.onFailure?.(failureOf(error), attempt);
      if (attempt === maxAttempts) break;
      const wait = nextRetryDelayMs(failureOf(error), attempt, options);
      if (wait === null) break;
      if (options.onWait) options.onWait(wait);
      else await sleep(wait);
    }
  }
  throw lastError;
}

/**
 * A pause every parallel worker honours. When the provider says "slow down", one worker's wait
 * becomes everyone's: otherwise eight workers discover the limit separately, each wait ends at the
 * same moment, and they burst into it again. Waiters are staggered a little for the same reason.
 */
export function createCooldownGate(options: { now?: () => number; sleep?: (ms: number) => Promise<void>; random?: () => number; staggerMs?: number } = {}) {
  const { now = () => Date.now(), sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)), random = Math.random, staggerMs = 400 } = options;
  let until = 0;
  return {
    /** Starts (or extends) the pause. */
    trip(ms: number): void {
      until = Math.max(until, now() + ms);
    },
    /** Resolves when the pause is over. */
    async wait(): Promise<void> {
      const remaining = until - now();
      if (remaining > 0) await sleep(remaining + Math.round(random() * staggerMs));
    },
    remainingMs: (): number => Math.max(0, until - now()),
  };
}

export interface EmbeddingBreaker {
  /** Records the outcome of one request (null = success). */
  record: (failure: EmbeddingFailure | null) => void;
  isOpen: () => boolean;
  /** The failure that opened it (or the most recent one if it never opened). */
  lastFailure: () => EmbeddingFailure | null;
}

/**
 * Stops a batch from issuing requests that cannot succeed. A used-up daily quota or rejected
 * credentials open it at once; a rate limit or a transient error opens it after
 * `maxConsecutiveFailures` in a row (each of those already went through its own retries).
 * A bad chunk (invalid input) says nothing about the provider and never opens it.
 */
export function createEmbeddingBreaker(options: { maxConsecutiveFailures?: number } = {}): EmbeddingBreaker {
  const { maxConsecutiveFailures = 3 } = options;
  let consecutive = 0;
  let open = false;
  let last: EmbeddingFailure | null = null;

  return {
    record(failure) {
      if (failure === null) {
        consecutive = 0;
        return;
      }
      if (failure.kind === 'invalid_input') return;
      last = failure;
      if (failure.kind === 'daily_quota' || failure.kind === 'auth') {
        open = true;
        return;
      }
      consecutive += 1;
      if (consecutive >= maxConsecutiveFailures) open = true;
    },
    isOpen: () => open,
    lastFailure: () => last,
  };
}

/** Chunks that still need an embedding: no stored vector, or one stored for different text. */
export function chunksToEmbed(chunkTexts: string[], stored: ReadonlyMap<number, string>): number[] {
  const todo: number[] = [];
  chunkTexts.forEach((text, index) => {
    if (stored.get(index) !== text) todo.push(index);
  });
  return todo;
}

/**
 * The message the document carries (`embedding_error`) so the state is visible, not silent.
 * Returns null when everything is indexed.
 */
export function describeEmbeddingOutcome(outcome: {
  total: number;
  indexed: number;
  failure: EmbeddingFailure | null;
}): string | null {
  const { total, indexed, failure } = outcome;
  if (indexed >= total) return null;
  const progress = `${indexed} of ${total} chunks are indexed.`;
  const unaffected = 'Reading, text search, highlights and chat about the open page keep working.';

  switch (failure?.kind) {
    case 'daily_quota':
      return `AI indexing paused: the embedding provider's daily quota is used up. ${progress} ${unaffected} Retry AI indexing after the quota resets.`;
    case 'rate_limit':
      return `AI indexing paused: the embedding provider is rate-limiting requests. ${progress} ${unaffected} Retry AI indexing in a few minutes.`;
    case 'auth':
      return `AI indexing is unavailable: the embedding provider rejected the request (authorization or billing). ${progress} ${unaffected}`;
    case 'transient':
      return `AI indexing was interrupted by a provider error. ${progress} ${unaffected} Retry AI indexing later.`;
    default:
      return `AI indexing is incomplete. ${progress} ${unaffected} Retry AI indexing.`;
  }
}
