import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Ctrl+F in the reader builds an ilike pattern for PostgREST. Verified against production with the
 * QA account: PostgREST rewrites every `*` in an ilike value to `%` and has no escape for it
 * (`name=ilike.%My*Space%` matched "My Workspace", which has no asterisk), so a typed `*` acted as
 * a wildcard and listed pages that do not contain what the user typed.
 */
const harness = vi.hoisted(() => ({
  patterns: [] as string[],
  native: [] as Array<{ page_number: number; page_text: string }>,
  ocr: [] as Array<{ page_number: number; text: string; origin: string; sequence: number }>,
  ranges: [] as Array<[number, number]>,
  /** a scripted failure for the OCR read of batch N (0-based) */
  ocrErrorAtBatch: null as number | null,
}));

vi.mock('../../src/lib/supabase', () => {
  function builder(table: string) {
    let range: [number, number] | null = null;
    const api: Record<string, unknown> = {
      select: () => api,
      eq: () => api,
      order: () => api,
      limit: () => api,
      range: (from: number, to: number) => {
        range = [from, to];
        harness.ranges.push(range);
        return api;
      },
      ilike: (_column: string, pattern: string) => {
        harness.patterns.push(pattern);
        return api;
      },
      then: (resolve: (value: unknown) => unknown) => {
        if (table === 'document_page_texts') return Promise.resolve({ data: harness.native, error: null }).then(resolve);
        const [from, to] = range ?? [0, harness.ocr.length - 1];
        const batch = from / (to - from + 1);
        if (harness.ocrErrorAtBatch === batch) {
          return Promise.resolve({ data: null, error: { message: 'statement timeout' } }).then(resolve);
        }
        return Promise.resolve({ data: harness.ocr.slice(from, to + 1), error: null }).then(resolve);
      },
    };
    return api;
  }
  return { supabase: { from: (table: string) => builder(table) } };
});

import { DocumentSearchRepository, toIlikePattern } from '../../src/repositories/document-search.repository';

beforeEach(() => {
  harness.patterns = [];
  harness.native = [];
  harness.ocr = [];
  harness.ranges = [];
  harness.ocrErrorAtBatch = null;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('toIlikePattern', () => {
  it('wraps a plain query', () => {
    expect(toIlikePattern('contract')).toBe('%contract%');
  });

  it('still escapes the SQL wildcards % _ and the backslash', () => {
    expect(toIlikePattern('100%')).toBe('%100\\%%');
    expect(toIlikePattern('a_b')).toBe('%a\\_b%');
    expect(toIlikePattern('a\\b')).toBe('%a\\\\b%');
  });

  it('never sends an asterisk to PostgREST (it would become a % wildcard)', () => {
    expect(toIlikePattern('2*3')).toBe('%2_3%');
    expect(toIlikePattern('**')).toBe('%__%');
    expect(toIlikePattern('2*3')).not.toContain('*');
  });
});

describe('DocumentSearchRepository.search with an asterisk', () => {
  it('drops pages that only matched because `*` was a wildcard', async () => {
    harness.native = [
      { page_number: 4, page_text: 'The formula 2*3 equals six.' },
      { page_number: 9, page_text: 'We bought 2x3 meter boards.' }, // `2_3` matches this, the literal does not
    ];

    const hits = await DocumentSearchRepository.search('doc-1', '2*3');

    expect(hits.map((hit) => hit.pageNumber)).toEqual([4]);
  });

  it('applies the same literal check to OCR segments', async () => {
    harness.ocr = [
      { page_number: 2, text: 'cost: 5*7', origin: 'ocr', sequence: 1 },
      { page_number: 3, text: 'room 5-7', origin: 'ocr', sequence: 1 },
    ];

    const hits = await DocumentSearchRepository.search('doc-1', '5*7');

    expect(hits.map((hit) => [hit.pageNumber, hit.source])).toEqual([[2, 'ocr']]);
  });

  it('matches the asterisk case-insensitively like ilike does', async () => {
    harness.native = [{ page_number: 1, text: '', page_text: 'NOTE*A is marked' } as never];

    const hits = await DocumentSearchRepository.search('doc-1', 'note*a');

    expect(hits.map((hit) => hit.pageNumber)).toEqual([1]);
  });
});

describe('DocumentSearchRepository.search without an asterisk', () => {
  it('trusts the server match: no extra filtering, same pattern as before', async () => {
    harness.native = [{ page_number: 7, page_text: 'Résumé de la réunion' }];

    const hits = await DocumentSearchRepository.search('doc-1', 'reunion');

    expect(harness.patterns).toEqual(['%reunion%', '%reunion%']);
    // the server (ilike) said it matches; the client must not second-guess it for ordinary queries
    expect(hits.map((hit) => hit.pageNumber)).toEqual([7]);
  });

  it('ignores queries shorter than two characters', async () => {
    await expect(DocumentSearchRepository.search('doc-1', ' a ')).resolves.toEqual([]);
    expect(harness.patterns).toEqual([]);
  });
});

describe('DocumentSearchRepository.search on a scanned document with a very common word', () => {
  // Production limit found in the audit: the OCR read stopped at 180 segments, so with ~12 matching
  // segments per page a word like "the" only ever listed the first 15 pages of a 300-page scan.
  const segmentsFor = (pages: number, perPage: number) =>
    Array.from({ length: pages * perPage }, (_, index) => ({
      page_number: Math.floor(index / perPage) + 1,
      text: 'the quick brown fox',
      origin: 'ocr',
      sequence: index % perPage,
    }));

  it('reaches later pages instead of stopping after the first 180 segments', async () => {
    harness.ocr = segmentsFor(300, 12); // 3600 matching segments

    const hits = await DocumentSearchRepository.search('doc-1', 'the', 60);

    expect(hits).toHaveLength(60);
    expect(hits[0].pageNumber).toBe(1);
    expect(hits[59].pageNumber).toBe(60);
    // every page that is listed was counted in full, not cut mid-page
    expect(hits.every((hit) => hit.matchCount === 12)).toBe(true);
  });

  it('stops reading as soon as the wanted pages are complete (bounded work)', async () => {
    harness.ocr = segmentsFor(300, 12);

    await DocumentSearchRepository.search('doc-1', 'the', 60);

    // 60 pages x 12 segments = 720 rows: two batches of 500 cover it, a third is never asked for
    expect(harness.ranges).toEqual([[0, 499], [500, 999]]);
  });

  it('never reads more than the batch ceiling, even if the matches never end', async () => {
    harness.ocr = segmentsFor(2000, 12); // 24000 segments

    const hits = await DocumentSearchRepository.search('doc-1', 'the', 5000);

    expect(harness.ranges.length).toBeLessThanOrEqual(6);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('does one read when the matches fit in a single batch', async () => {
    harness.ocr = segmentsFor(3, 2);

    const hits = await DocumentSearchRepository.search('doc-1', 'the', 60);

    expect(harness.ranges).toEqual([[0, 499]]);
    expect(hits.map((hit) => hit.pageNumber)).toEqual([1, 2, 3]);
  });

  it('keeps what it already read when a later batch fails', async () => {
    harness.ocr = segmentsFor(300, 12);
    harness.ocrErrorAtBatch = 1;

    const hits = await DocumentSearchRepository.search('doc-1', 'the', 60);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].pageNumber).toBe(1);
  });

  it('reports a failure of the very first OCR read only when native search failed too', async () => {
    harness.ocr = segmentsFor(3, 2);
    harness.ocrErrorAtBatch = 0;
    harness.native = [{ page_number: 8, page_text: 'the end' }];

    const hits = await DocumentSearchRepository.search('doc-1', 'the', 60);

    expect(hits.map((hit) => hit.pageNumber)).toEqual([8]);
  });
});
