import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { supabase } from '../../src/lib/supabase';
import { SentenceInventory, type FlowWord, type Sentence } from '../../src/lib/ai/SentenceInventory';
import { AiHighlightService } from '../../src/lib/ai/AiHighlightService';

const store = vi.hoisted(() => ({
  highlights: {} as Record<string, unknown[]>,
  removeHighlight: vi.fn(),
  addHighlight: vi.fn(),
}));

vi.mock('../../src/stores/highlightStore', () => ({
  useHighlightStore: { getState: () => store },
}));

const TEXT_1 = 'Mitosis produces two genetically identical daughter cells.';
const TEXT_2 = 'Meiosis reduces the number of chromosomes by half.';

function sentence(page: number, text: string): Sentence {
  const words: FlowWord[] = text.split(' ').map((word, index) => ({
    text: word,
    rect: { x: 0.05 + index * 0.1, y: 0.1, width: 0.09, height: 0.02 },
    lineIndex: 0,
  }));
  return { sentence_key: `p${page}-S1`, page_number: page, words, text };
}

const fetchMock = vi.fn();

const oldAiHighlight = (id: string, page: number) => ({ id, source: 'ai', page_index: page - 1 });
const okResponse = (quote: string, key: string) => ({
  ok: true,
  status: 200,
  json: async () => ({
    selections: [{ sentence_key: key, quote, category: 'definition', confidence: 0.9 }],
    model: 'test-model',
    quota_run_token: 'run-1',
  }),
});
const failure = (status: number, body: Record<string, unknown>) => ({
  ok: false,
  status,
  json: async () => body,
});

function run(overrides: Partial<Parameters<typeof AiHighlightService.highlightDocument>[0]> = {}) {
  return AiHighlightService.highlightDocument({
    file: new Blob(['%PDF-1.4']),
    documentId: 'doc-1',
    workspaceId: 'ws-1',
    scope: 'document',
    density: 'normal',
    ...overrides,
  });
}

beforeEach(() => {
  store.highlights = { 'doc-1': [] };
  store.removeHighlight.mockReset().mockResolvedValue(undefined);
  store.addHighlight.mockReset().mockImplementation(async (input: Record<string, unknown>) => ({ id: 'new', ...input }));
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
  vi.spyOn(SentenceInventory, 'buildNativeSentences').mockResolvedValue({
    scannedPages: [],
    totalPages: 2,
    perPage: [
      { page_number: 1, sentences: [sentence(1, TEXT_1)], totalChars: TEXT_1.length },
      { page_number: 2, sentences: [sentence(2, TEXT_2)], totalChars: TEXT_2.length },
    ],
  } as never);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AI Highlight: re-running never destroys highlights it could not replace', () => {
  it('keeps the previous AI highlights when the daily limit refuses the request', async () => {
    store.highlights['doc-1'] = [oldAiHighlight('old-1', 1), oldAiHighlight('old-2', 2)];
    fetchMock.mockResolvedValue(failure(429, {
      error: 'Daily AI request limit reached (50/50).',
      quota: { used: 50, limit: 50, resets_at: '2026-10-01T00:00:00.000Z' },
    }));

    const summary = await run();

    expect(store.removeHighlight).not.toHaveBeenCalled();
    expect(summary.created).toBe(0);
    expect(summary.failedPages.map((entry) => entry.page)).toEqual([1, 2]);
  });

  it('stops asking once the daily limit is hit instead of sending one refused request per page', async () => {
    fetchMock.mockResolvedValue(failure(429, {
      error: 'Daily AI request limit reached (50/50).',
      quota: { used: 50, limit: 50, resets_at: '2026-10-01T00:00:00.000Z' },
    }));

    await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does keep going after a transient overload (429 without a quota payload)', async () => {
    fetchMock
      .mockResolvedValueOnce(failure(429, { error: 'The AI service is saturated.' }))
      .mockResolvedValueOnce(okResponse(TEXT_2, 'p2-S1'));

    const summary = await run();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(summary.created).toBe(1);
    expect(summary.failedPages.map((entry) => entry.page)).toEqual([1]);
  });

  it('replaces a page\'s old AI highlights only after that page was analysed, leaving failed pages untouched', async () => {
    store.highlights['doc-1'] = [
      oldAiHighlight('old-page-1', 1),
      oldAiHighlight('old-page-2', 2),
      { id: 'manual-1', source: 'manual', page_index: 0 },
    ];
    fetchMock
      .mockResolvedValueOnce(okResponse(TEXT_1, 'p1-S1'))
      .mockResolvedValueOnce(failure(503, { error: 'The AI service is saturated.' }));

    const summary = await run();

    expect(summary.created).toBe(1);
    expect(store.removeHighlight).toHaveBeenCalledTimes(1);
    expect(store.removeHighlight).toHaveBeenCalledWith('old-page-1');
    expect(store.removeHighlight).not.toHaveBeenCalledWith('old-page-2');
    expect(store.removeHighlight).not.toHaveBeenCalledWith('manual-1');
  });

  it('keeps the old highlights when the model answered but none of its quotes could be verified', async () => {
    store.highlights['doc-1'] = [oldAiHighlight('old-page-1', 1)];
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        selections: [{ sentence_key: 'p1-S1', quote: 'a quote that is not in the sentence', category: 'key_fact', confidence: 0.9 }],
        model: 'test-model',
      }),
    });

    const summary = await run({ scope: 'page', pageNumber: 1 });

    expect(summary.created).toBe(0);
    expect(store.removeHighlight).not.toHaveBeenCalled();
  });

  it('clears the old highlights of a page the model legitimately found nothing to highlight in', async () => {
    store.highlights['doc-1'] = [oldAiHighlight('old-page-1', 1)];
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ selections: [], model: 'test-model' }) });

    await run({ scope: 'page', pageNumber: 1 });

    expect(store.removeHighlight).toHaveBeenCalledWith('old-page-1');
  });

  it('never removes anything when replaceExisting is false (chat-triggered highlights)', async () => {
    store.highlights['doc-1'] = [oldAiHighlight('old-page-1', 1)];
    fetchMock.mockResolvedValue(okResponse(TEXT_1, 'p1-S1'));

    await run({ scope: 'page', pageNumber: 1, replaceExisting: false });

    expect(store.removeHighlight).not.toHaveBeenCalled();
    expect(store.addHighlight).toHaveBeenCalledTimes(1);
  });
});

describe('AI Highlight: geometry always comes from real words', () => {
  it('drops a quote that is not verbatim in its sentence instead of approximating it', async () => {
    fetchMock.mockResolvedValue(okResponse('Mitosis produces four identical cells.', 'p1-S1'));

    const summary = await run({ scope: 'page', pageNumber: 1 });

    expect(summary.created).toBe(0);
    expect(store.addHighlight).not.toHaveBeenCalled();
  });

  it('builds the highlight rects from the sentence words, never from the model', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        // A model that tried to smuggle geometry in must be ignored.
        selections: [{ sentence_key: 'p1-S1', quote: TEXT_1, category: 'definition', confidence: 0.9, rects: [{ x: 9, y: 9, width: 9, height: 9 }] }],
        model: 'test-model',
      }),
    });

    await run({ scope: 'page', pageNumber: 1 });

    const created = store.addHighlight.mock.calls[0][0] as { rects: Array<{ x: number; y: number }>; text: string };
    expect(created.text).toBe(TEXT_1);
    expect(created.rects.length).toBeGreaterThan(0);
    expect(created.rects.every((rect) => rect.x < 1 && rect.y < 1)).toBe(true);
  });
});

describe('AI Highlight: a long run does not outlive the access token it started with', () => {
  /**
   * A whole-document run is OCR plus one request per page, which can take longer than the access token lives
   * (one hour). The token used to be read once before the loop and sent with every page, so past its expiry every
   * remaining page failed with 401. supabase-js refreshes a token on getSession(): it has to be asked per request.
   */
  const authorizationOf = (callIndex: number) => (fetchMock.mock.calls[callIndex][1] as { headers: Record<string, string> }).headers.Authorization;

  it('asks for the session again before every page request', async () => {
    let issued = 0;
    (supabase.auth.getSession as Mock).mockReset().mockImplementation(async () => ({
      data: { session: { access_token: `token-${++issued}` } },
      error: null,
    }));
    fetchMock.mockResolvedValueOnce(okResponse(TEXT_1, 'p1-S1')).mockResolvedValueOnce(okResponse(TEXT_2, 'p2-S1'));

    await run();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authorizationOf(0)).not.toBe(authorizationOf(1));
  });

  it('uses the refreshed token when it changes mid-run', async () => {
    (supabase.auth.getSession as Mock).mockReset()
      .mockResolvedValueOnce({ data: { session: { access_token: 'expiring' } }, error: null })
      .mockResolvedValueOnce({ data: { session: { access_token: 'expiring' } }, error: null })
      .mockResolvedValue({ data: { session: { access_token: 'refreshed' } }, error: null });
    fetchMock.mockResolvedValueOnce(okResponse(TEXT_1, 'p1-S1')).mockResolvedValueOnce(okResponse(TEXT_2, 'p2-S1'));

    await run();

    expect(authorizationOf(1)).toBe('Bearer refreshed');
  });

  it('stops and says so when the session is gone mid-run, instead of sending requests that cannot succeed', async () => {
    (supabase.auth.getSession as Mock).mockReset()
      .mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null })
      .mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null })
      .mockResolvedValue({ data: { session: null }, error: null });
    fetchMock.mockResolvedValueOnce(okResponse(TEXT_1, 'p1-S1'));

    const summary = await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(summary.created).toBe(1);
    expect(summary.failedPages.map((entry) => entry.page)).toEqual([2]);
    expect(summary.failedPages[0].error).toMatch(/sesión expiró/i);
  });
});
