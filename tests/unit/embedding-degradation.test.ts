import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  EmbeddingHttpError,
  chunksToEmbed,
  classifyEmbeddingFailure,
  createCooldownGate,
  createEmbeddingBreaker,
  describeEmbeddingOutcome,
  embedWithRetry,
  nextRetryDelayMs,
  parseRetryDelayMs,
  type EmbeddingFailure,
} from '../../supabase/functions/_shared/embeddings';
import { andTsQuery, chunkIndexOf, keywordTerms, orTsQuery, rankKeywordChunks, scoreChunk } from '../../supabase/functions/_shared/keywordSearch';
import { normalizeHybridRows, retrieveWithFallback, type RetrievedRow } from '../../supabase/functions/_shared/ragFallback';

/**
 * Production evidence: Gemini answered 429 "You exceeded your current quota" for 19 of 120 chunks,
 * and the whole pipeline had no way to tell "slow down" from "done for today", no retry, and no
 * stop: a used-up daily quota would be hit once per chunk (457 requests for a 457-chunk document).
 * Nothing told the user their AI search was limited, and whole-document chat lost its retrieval.
 */

const quotaBody = (quotaId: string, retryDelay?: string) =>
  JSON.stringify({
    error: {
      code: 429,
      message: 'You exceeded your current quota, please check your plan and billing details.',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/embed_content_free_tier_requests', quotaId }] },
        ...(retryDelay ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay }] : []),
      ],
    },
  });

const failure = (kind: EmbeddingFailure['kind'], retryAfterMs: number | null = null): EmbeddingFailure => ({ kind, status: kind === 'rate_limit' || kind === 'daily_quota' ? 429 : 500, retryAfterMs, detail: kind });
const httpError = (kind: EmbeddingFailure['kind'], retryAfterMs: number | null = null) => new EmbeddingHttpError(failure(kind, retryAfterMs));

describe('classifyEmbeddingFailure', () => {
  it('reads a per-minute 429 as a rate limit and keeps the delay the provider asked for', () => {
    const result = classifyEmbeddingFailure(429, quotaBody('EmbedContentRequestsPerMinutePerProjectPerModel-FreeTier', '37s'));
    expect(result).toMatchObject({ kind: 'rate_limit', status: 429, retryAfterMs: 37_000 });
  });

  it('reads a per-day 429 as the daily quota being used up', () => {
    const result = classifyEmbeddingFailure(429, quotaBody('EmbedContentRequestsPerDayPerProjectPerModel-FreeTier'));
    expect(result.kind).toBe('daily_quota');
  });

  it('treats a 429 it cannot parse as a rate limit (the safer reading)', () => {
    expect(classifyEmbeddingFailure(429, 'upstream said no')).toMatchObject({ kind: 'rate_limit', retryAfterMs: null });
  });

  it('separates credentials, bad input and provider errors', () => {
    expect(classifyEmbeddingFailure(401, '{}').kind).toBe('auth');
    expect(classifyEmbeddingFailure(403, '{}').kind).toBe('auth');
    expect(classifyEmbeddingFailure(400, '{}').kind).toBe('invalid_input');
    expect(classifyEmbeddingFailure(503, '{}').kind).toBe('transient');
  });

  it('captures which quota the provider says was hit, to log the real limit', () => {
    const body = JSON.stringify({ error: { code: 429, message: 'quota', details: [{ violations: [{ quotaId: 'EmbedContentRequestsPerMinutePerProjectPerModel-FreeTier', quotaValue: '100' }] }] } });
    expect(classifyEmbeddingFailure(429, body).quota).toBe('EmbedContentRequestsPerMinutePerProjectPerModel-FreeTier=100');
    expect(classifyEmbeddingFailure(429, 'upstream said no').quota).toBeNull();
  });

  it('keeps a short, single-line detail', () => {
    const detail = classifyEmbeddingFailure(429, quotaBody('x')).detail;
    expect(detail.length).toBeLessThanOrEqual(160);
    expect(detail).not.toContain('\n');
  });
});

describe('parseRetryDelayMs', () => {
  it('reads seconds and milliseconds', () => {
    expect(parseRetryDelayMs('37s')).toBe(37_000);
    expect(parseRetryDelayMs('1.5s')).toBe(1500);
    expect(parseRetryDelayMs('250ms')).toBe(250);
    expect(parseRetryDelayMs('soon')).toBeNull();
    expect(parseRetryDelayMs(undefined)).toBeNull();
  });
});

describe('nextRetryDelayMs', () => {
  const options = { random: () => 0 };

  it('never retries what a retry cannot fix', () => {
    for (const kind of ['daily_quota', 'auth', 'invalid_input'] as const) expect(nextRetryDelayMs(failure(kind), 1, options)).toBeNull();
  });

  it('waits what the provider asked for when that is short enough', () => {
    expect(nextRetryDelayMs(failure('rate_limit', 3000), 1, options)).toBe(3000);
  });

  it('does not wait out a long provider delay inside one invocation (it defers instead)', () => {
    expect(nextRetryDelayMs(failure('rate_limit', 37_000), 1, options)).toBeNull();
  });

  it('backs a rate limit off in seconds (it is a per-minute window), within the budget it has', () => {
    const wide = { random: () => 0, maxInlineWaitMs: 60_000 };
    expect(nextRetryDelayMs(failure('rate_limit'), 1, wide)).toBe(5000);
    expect(nextRetryDelayMs(failure('rate_limit'), 2, wide)).toBe(10_000);
    // less budget than the backoff asks for: use what is left, unless that is less than one step
    expect(nextRetryDelayMs(failure('rate_limit'), 2, { random: () => 0, maxInlineWaitMs: 8000 })).toBe(8000);
    expect(nextRetryDelayMs(failure('rate_limit'), 1, { random: () => 0, maxInlineWaitMs: 3000 })).toBeNull();
    expect(nextRetryDelayMs(failure('rate_limit'), 1, { random: () => 0, maxInlineWaitMs: 0 })).toBeNull();
  });

  it('backs off exponentially, capped, when the provider gave no delay', () => {
    expect(nextRetryDelayMs(failure('transient'), 1, options)).toBe(800);
    expect(nextRetryDelayMs(failure('transient'), 2, options)).toBe(1600);
    expect(nextRetryDelayMs(failure('transient'), 6, options)).toBe(10_000);
  });
});

describe('embedWithRetry', () => {
  const sleep = () => vi.fn().mockResolvedValue(undefined);

  it('retries a rate limit a bounded number of times and then succeeds', async () => {
    const wait = sleep();
    const call = vi.fn().mockRejectedValueOnce(httpError('rate_limit')).mockRejectedValueOnce(httpError('rate_limit')).mockResolvedValue('vector');

    await expect(embedWithRetry(call, { sleep: wait, random: () => 0 })).resolves.toBe('vector');
    expect(call).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('gives up after the attempts are used', async () => {
    const call = vi.fn().mockRejectedValue(httpError('rate_limit'));
    await expect(embedWithRetry(call, { sleep: sleep(), random: () => 0 })).rejects.toBeInstanceOf(EmbeddingHttpError);
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('does not retry a used-up daily quota, bad credentials or a bad chunk', async () => {
    for (const kind of ['daily_quota', 'auth', 'invalid_input'] as const) {
      const call = vi.fn().mockRejectedValue(httpError(kind));
      await expect(embedWithRetry(call, { sleep: sleep() })).rejects.toBeInstanceOf(EmbeddingHttpError);
      expect(call, kind).toHaveBeenCalledTimes(1);
    }
  });

  it('does not wait for a provider delay it cannot afford', async () => {
    const wait = sleep();
    const call = vi.fn().mockRejectedValue(httpError('rate_limit', 60_000));
    await expect(embedWithRetry(call, { sleep: wait })).rejects.toBeInstanceOf(EmbeddingHttpError);
    expect(call).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  /**
   * Production (smoke test after the merge): a 120-chunk document's embedding stage took 87 s against a 60 s budget.
   * The wait allowed was worked out once, when a chunk started; a chunk that had been retrying since second 1 still
   * believed it had 59 s left at second 58, waited the 26 s the provider asked for and paused every worker with it.
   */
  it('re-reads the time it can afford before every wait, not once when it starts', async () => {
    const wait = sleep();
    let affordable = 59_000;
    const maxInlineWaitMs = vi.fn(() => affordable);
    const call = vi.fn().mockImplementation(async () => {
      affordable = 2_000; // the stage's budget is almost used up by the time the first attempt fails
      throw httpError('rate_limit', 26_000);
    });

    await expect(embedWithRetry(call, { sleep: wait, random: () => 0, maxInlineWaitMs })).rejects.toBeInstanceOf(EmbeddingHttpError);

    expect(maxInlineWaitMs).toHaveBeenCalled();
    expect(wait).not.toHaveBeenCalled(); // 26 s no longer fits
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('still waits when the budget left does cover the provider\'s delay', async () => {
    const wait = sleep();
    const call = vi.fn().mockRejectedValueOnce(httpError('rate_limit', 26_000)).mockResolvedValue('vector');
    await expect(embedWithRetry(call, { sleep: wait, random: () => 0, maxInlineWaitMs: () => 40_000 })).resolves.toBe('vector');
    expect(wait).toHaveBeenCalledWith(26_000);
  });

  it('treats a network error as transient and retries it', async () => {
    const call = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValue('vector');
    await expect(embedWithRetry(call, { sleep: sleep(), random: () => 0 })).resolves.toBe('vector');
  });
});

describe('createCooldownGate (every worker pauses together)', () => {
  it('does not wait when nothing tripped it', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    await createCooldownGate({ sleep }).wait();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('makes a wait that one worker discovered everyone\'s wait', async () => {
    // all three ask at the same instant (the clock does not move while they start waiting)
    const sleep = vi.fn().mockResolvedValue(undefined);
    const gate = createCooldownGate({ now: () => 1000, sleep, random: () => 0 });

    gate.trip(8000);
    await Promise.all([gate.wait(), gate.wait(), gate.wait()]);

    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.every(([ms]) => ms === 8000)).toBe(true);
  });

  it('never shortens a longer pause and is over once the time has passed', async () => {
    let clock = 0;
    const gate = createCooldownGate({ now: () => clock, sleep: async () => undefined, random: () => 0 });
    gate.trip(10_000);
    gate.trip(2000);
    expect(gate.remainingMs()).toBe(10_000);
    clock = 10_001;
    expect(gate.remainingMs()).toBe(0);
  });

  it('staggers the waiters a little so they do not burst into the limit together', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const gate = createCooldownGate({ now: () => 0, sleep, random: () => 0.5, staggerMs: 400 });
    gate.trip(1000);
    await gate.wait();
    expect(sleep).toHaveBeenCalledWith(1200);
  });
});

describe('embedWithRetry with a shared gate', () => {
  it('hands the wait to the gate instead of sleeping in place, and waits on it before the next attempt', async () => {
    const order: string[] = [];
    const call = vi.fn().mockImplementation(async () => {
      order.push('call');
      if (call.mock.calls.length === 1) throw httpError('rate_limit', 4000);
      return 'vector';
    });

    await expect(embedWithRetry(call, {
      random: () => 0,
      maxInlineWaitMs: 60_000,
      beforeAttempt: async () => { order.push('gate'); },
      onWait: (ms) => order.push(`wait:${ms}`),
      sleep: async () => { order.push('SLEPT'); },
    })).resolves.toBe('vector');

    expect(order).toEqual(['gate', 'call', 'wait:4000', 'gate', 'call']);
  });
});

describe('embedWithRetry reports every failed attempt', () => {
  it('tells the caller what the provider said even when the retry then succeeds', async () => {
    const seen: Array<[string, number]> = [];
    const call = vi.fn().mockRejectedValueOnce(httpError('rate_limit', 1000)).mockRejectedValueOnce(httpError('rate_limit', 1000)).mockResolvedValue('vector');

    await embedWithRetry(call, { sleep: async () => undefined, random: () => 0, onFailure: (failure, attempt) => seen.push([failure.kind, attempt]) });

    expect(seen).toEqual([['rate_limit', 1], ['rate_limit', 2]]);
  });
});

describe('createEmbeddingBreaker', () => {
  it('opens at once when the daily quota is used up or credentials are rejected', () => {
    for (const kind of ['daily_quota', 'auth'] as const) {
      const breaker = createEmbeddingBreaker();
      breaker.record(failure(kind));
      expect(breaker.isOpen(), kind).toBe(true);
    }
  });

  it('opens after consecutive rate limits, not after a single one', () => {
    const breaker = createEmbeddingBreaker({ maxConsecutiveFailures: 3 });
    breaker.record(failure('rate_limit'));
    breaker.record(failure('rate_limit'));
    expect(breaker.isOpen()).toBe(false);
    breaker.record(failure('rate_limit'));
    expect(breaker.isOpen()).toBe(true);
  });

  it('a success in between resets the count', () => {
    const breaker = createEmbeddingBreaker({ maxConsecutiveFailures: 3 });
    breaker.record(failure('rate_limit'));
    breaker.record(failure('rate_limit'));
    breaker.record(null);
    breaker.record(failure('rate_limit'));
    expect(breaker.isOpen()).toBe(false);
  });

  it('a bad chunk says nothing about the provider and never opens it', () => {
    const breaker = createEmbeddingBreaker({ maxConsecutiveFailures: 1 });
    for (let i = 0; i < 5; i += 1) breaker.record(failure('invalid_input'));
    expect(breaker.isOpen()).toBe(false);
  });

  it('remembers the failure that opened it', () => {
    const breaker = createEmbeddingBreaker();
    breaker.record(failure('daily_quota'));
    expect(breaker.lastFailure()?.kind).toBe('daily_quota');
  });
});

describe('chunksToEmbed (a retry does not pay twice for what is already indexed)', () => {
  it('skips chunks whose stored vector was made from the same text', () => {
    const stored = new Map([[0, 'alpha'], [1, 'beta'], [2, 'gamma']]);
    expect(chunksToEmbed(['alpha', 'beta', 'gamma', 'delta'], stored)).toEqual([3]);
  });

  it('re-embeds a chunk whose text changed since it was stored', () => {
    expect(chunksToEmbed(['alpha', 'BETA'], new Map([[0, 'alpha'], [1, 'beta']]))).toEqual([1]);
  });

  it('embeds everything when nothing is stored', () => {
    expect(chunksToEmbed(['a', 'b', 'c'], new Map())).toEqual([0, 1, 2]);
  });
});

describe('describeEmbeddingOutcome', () => {
  it('is silent when everything is indexed', () => {
    expect(describeEmbeddingOutcome({ total: 10, indexed: 10, failure: null })).toBeNull();
  });

  it('says what happened, how much is indexed, and what keeps working', () => {
    const daily = describeEmbeddingOutcome({ total: 457, indexed: 12, failure: failure('daily_quota') })!;
    expect(daily).toContain('daily quota');
    expect(daily).toContain('12 of 457');
    expect(daily).toContain('Reading, text search, highlights');

    expect(describeEmbeddingOutcome({ total: 5, indexed: 0, failure: failure('rate_limit') })).toContain('rate-limiting');
    expect(describeEmbeddingOutcome({ total: 5, indexed: 0, failure: failure('transient') })).toContain('provider error');
    expect(describeEmbeddingOutcome({ total: 5, indexed: 2, failure: null })).toContain('incomplete');
  });

  it('does not expose provider internals for an authorization failure', () => {
    const message = describeEmbeddingOutcome({ total: 5, indexed: 0, failure: { ...failure('auth'), detail: 'API key AIza... is invalid' } })!;
    expect(message).not.toMatch(/AIza|key/i);
  });
});

describe('keywordTerms', () => {
  it('keeps what a question is about and drops filler, in English and Spanish', () => {
    expect(keywordTerms('What is the refund policy for annual plans?')).toEqual(['refund', 'policy', 'annual', 'plans']);
    expect(keywordTerms('explícame la política de reembolso')).toEqual(['política', 'reembolso']);
  });

  it('keeps a short number (page 55) and drops other short words', () => {
    expect(keywordTerms('pág 55 de la guía')).toEqual(['pág', '55', 'guía']);
  });

  it('deduplicates, caps the count and keeps only letters and digits (no query operators)', () => {
    expect(keywordTerms("alpha alpha beta")).toEqual(['alpha', 'beta']);
    expect(keywordTerms('a b c d e f g h i j k l m n o p'.split(' ').map((w) => w + w + w).join(' '), 4)).toHaveLength(4);
    const hostile = keywordTerms("foo'; drop table x | & ! ( ) <-> bar");
    expect(hostile.join(' ')).toMatch(/^[\p{L}\p{N} ]+$/u);
    expect(andTsQuery(hostile)).not.toMatch(/[()!<>']/);
    expect(orTsQuery(['uno', 'dos'])).toBe('uno | dos');
    expect(andTsQuery(['uno', 'dos'])).toBe('uno & dos');
  });
});

describe('ranking keyword matches', () => {
  it('prefers a chunk with more of the distinct terms over one that repeats a single term', () => {
    const terms = ['refund', 'policy'];
    expect(scoreChunk('refund policy details', terms)).toBeGreaterThan(scoreChunk('refund refund refund refund', terms));
  });

  it('drops chunks with no term, orders by score then page, and honours the limit', () => {
    const chunks = [
      { content: 'nothing here', page_number: 1 },
      { content: 'refund policy', page_number: 7 },
      { content: 'refund policy', page_number: 3 },
      { content: 'only refund', page_number: 2 },
    ];
    const ranked = rankKeywordChunks(chunks, ['refund', 'policy'], 2);
    expect(ranked.map((chunk) => chunk.page_number)).toEqual([3, 7]);
  });

  it('reads the chunk index out of a document_chunks id', () => {
    expect(chunkIndexOf('3f2a_p12_c4')).toBe(4);
    expect(chunkIndexOf('odd-id')).toBe(0);
  });
});

describe('retrieveWithFallback (chat and search keep working without embeddings)', () => {
  const row = (page: number): RetrievedRow => ({ document_id: 'd1', chunk_index: page, chunk_text: `text ${page}`, similarity: 0.9, keyword_rank: 0.1, combined_score: 0.7, page_number: page, chunk_type: 'paragraph' });
  const deps = (overrides: Partial<Parameters<typeof retrieveWithFallback>[0]> = {}) => ({
    semantic: vi.fn().mockResolvedValue([row(1)]),
    hasEmbeddings: vi.fn().mockResolvedValue(true),
    keyword: vi.fn().mockResolvedValue([row(9)]),
    ...overrides,
  });

  it('uses semantic search when it finds something, and never touches the keyword path', async () => {
    const d = deps();
    const outcome = await retrieveWithFallback(d);
    expect(outcome).toMatchObject({ mode: 'hybrid', degradedReason: null });
    expect(outcome.rows.map((r) => r.page_number)).toEqual([1]);
    expect(d.keyword).not.toHaveBeenCalled();
  });

  it('falls back to keyword search when the embedding provider is out of quota', async () => {
    const onSemanticFailure = vi.fn();
    const d = deps({ semantic: vi.fn().mockRejectedValue(httpError('daily_quota')), onSemanticFailure });
    const outcome = await retrieveWithFallback(d);
    expect(outcome).toMatchObject({ mode: 'keyword', degradedReason: 'embedding_daily_quota' });
    expect(outcome.rows.map((r) => r.page_number)).toEqual([9]);
    expect(onSemanticFailure).toHaveBeenCalledOnce();
  });

  it('also falls back when the semantic search itself breaks', async () => {
    const outcome = await retrieveWithFallback(deps({ semantic: vi.fn().mockRejectedValue(new Error('dimension mismatch')) }));
    expect(outcome).toMatchObject({ mode: 'keyword', degradedReason: 'semantic_search_failed' });
  });

  it('falls back when the document was never indexed (nothing to match semantically)', async () => {
    const outcome = await retrieveWithFallback(deps({ semantic: vi.fn().mockResolvedValue([]), hasEmbeddings: vi.fn().mockResolvedValue(false) }));
    expect(outcome).toMatchObject({ mode: 'keyword', degradedReason: 'not_indexed' });
    expect(outcome.rows).toHaveLength(1);
  });

  it('keeps an honest empty answer when the document IS indexed and nothing matches', async () => {
    const d = deps({ semantic: vi.fn().mockResolvedValue([]), hasEmbeddings: vi.fn().mockResolvedValue(true) });
    const outcome = await retrieveWithFallback(d);
    expect(outcome).toEqual({ rows: [], mode: 'hybrid', degradedReason: null });
    expect(d.keyword).not.toHaveBeenCalled();
  });

  it('still fails when the keyword path fails too (nothing left to fall back to)', async () => {
    await expect(retrieveWithFallback(deps({ semantic: vi.fn().mockRejectedValue(httpError('rate_limit')), keyword: vi.fn().mockRejectedValue(new Error('db down')) }))).rejects.toThrow('db down');
  });
});

describe('normalizeHybridRows (hybrid_search returns chunk_id, clients read chunk_index)', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    document_id: 'doc-1',
    chunk_text: 'text',
    similarity: 0.7,
    keyword_rank: 0.1,
    combined_score: 0.5,
    page_number: 3,
    chunk_type: 'paragraph',
    ...overrides,
  });

  it('turns the text chunk_id into the numeric chunk_index the contract promises', () => {
    const [first] = normalizeHybridRows([row({ chunk_id: '17' })]);
    expect(first.chunk_index).toBe(17);
    expect(first).not.toHaveProperty('chunk_id');
  });

  it('keeps two chunks of one document distinguishable (they shared the key "<doc>-undefined")', () => {
    const rows = normalizeHybridRows([row({ chunk_id: '4' }), row({ chunk_id: '9' })]);
    expect(new Set(rows.map((entry) => `${entry.document_id}-${entry.chunk_index}`)).size).toBe(2);
  });

  it('prefers an existing numeric chunk_index and falls back to the position when nothing is usable', () => {
    expect(normalizeHybridRows([row({ chunk_index: 5, chunk_id: '99' })])[0].chunk_index).toBe(5);
    const unusable = normalizeHybridRows([row({ chunk_id: null }), row({ chunk_id: 'not-a-number' }), row({ chunk_id: '-3' })]);
    expect(unusable.map((entry) => entry.chunk_index)).toEqual([0, 1, 2]);
  });

  it('rag-retrieve normalizes the rows the RPC returns', () => {
    const source = readFileSync(resolve(__dirname, '../../supabase/functions/rag-retrieve/index.ts'), 'utf8');
    expect(source).toContain('return normalizeHybridRows(data ?? [])');
  });
});

describe('the Edge Functions use them', () => {
  const read = (name: string) => readFileSync(resolve(__dirname, `../../supabase/functions/${name}/index.ts`), 'utf8');

  it('process-document stops issuing requests once the provider cannot answer, retries only what a retry can fix and skips what is stored', () => {
    const source = read('process-document');
    expect(source).toContain('createEmbeddingBreaker()');
    expect(source).toContain('while (!breaker.isOpen())');
    expect(source).toContain('embedWithRetry(() => embedOne(');
    expect(source).toContain('createCooldownGate()');
    expect(source).toContain('STAGE_BUDGET_MS');
    // the stage must end well before the invocation's own clock does
    expect(source).toContain('invocationStart + 80_000');
    expect(source).toContain('Embedding stage:');
    expect(source).toContain('chunksToEmbed(chunkTexts, await loadStoredChunkTexts(');
    expect(source).toContain('describeEmbeddingOutcome({');
    expect(source).toContain('classifyEmbeddingFailure(res.status, body)');
  });

  it('process-document keeps the embedding stage inside its budget: remaining time per attempt, no new chunk after the deadline, a timeout per request', () => {
    const source = read('process-document');
    expect(source).toContain('maxInlineWaitMs: () => Math.min(60_000, Math.max(0, deadline - Date.now()))');
    expect(source).toContain('if (Date.now() >= deadline) return');
    expect(source).toContain('signal: AbortSignal.timeout(EMBED_REQUEST_TIMEOUT_MS)');
  });

  it('process-document no longer throws away what it embedded when the run was cut short', () => {
    const source = read('process-document');
    // the old behaviour: any failure inside generateEmbeddings discarded the whole run
    expect(source).not.toContain('AI embeddings deferred');
    expect(source).toContain('run.succeeded > 0');
  });

  it('rag-retrieve answers from stored text instead of failing when semantic search is unavailable', () => {
    const source = read('rag-retrieve');
    expect(source).toContain('retrieveWithFallback({');
    expect(source).toContain('GEMINI_API_KEY not configured');
    // a missing key used to be a 500 for the whole search
    expect(source).not.toMatch(/GEMINI_API_KEY not configured'[^\n]*status: 500/);
    expect(source).toContain('degraded');
  });
});
