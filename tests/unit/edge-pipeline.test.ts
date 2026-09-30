import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_JOB_STATUSES,
  JobSupersededError,
  createHeartbeat,
  loadAllPageTexts,
} from '../../supabase/functions/_shared/pipeline';

type Job = { status: string; progress: number; progress_heartbeat?: string };

/** In-memory `processing_jobs` honouring update().eq().in().select(), like PostgREST does. */
function fakeJobsClient(jobs: Record<string, Job>, failWith?: { message: string }) {
  const requests: Array<{ id: string; patch: Record<string, unknown> }> = [];
  return {
    requests,
    from: () => {
      let patch: Record<string, unknown> = {};
      let id = '';
      let allowed: string[] | null = null;
      const builder: Record<string, unknown> = {
        update: (value: Record<string, unknown>) => { patch = value; return builder; },
        eq: (_column: string, value: string) => { id = value; return builder; },
        in: (_column: string, values: string[]) => { allowed = values; return builder; },
        select: () => builder,
        then: (resolve: (value: unknown) => unknown) => {
          requests.push({ id, patch });
          if (failWith) return Promise.resolve({ data: null, error: failWith }).then(resolve);
          const job = jobs[id];
          const matches = Boolean(job) && (!allowed || allowed.includes(job.status));
          if (matches) Object.assign(job, patch);
          return Promise.resolve({ data: matches ? [{ id }] : [], error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('job heartbeat', () => {
  it('records progress and the heartbeat of a live job', async () => {
    const jobs = { j1: { status: 'queued', progress: 0 } };
    const heartbeat = createHeartbeat(fakeJobsClient(jobs), 'j1', () => new Date('2026-09-30T12:00:00.000Z'));

    await heartbeat('extracting', 30);

    expect(jobs.j1).toMatchObject({
      status: 'extracting',
      progress: 30,
      progress_heartbeat: '2026-09-30T12:00:00.000Z',
    });
  });

  it.each(['cancelled', 'failed', 'completed'])(
    'never resurrects a %s job, and tells the run to stop',
    async (finalStatus) => {
      const jobs = { j1: { status: finalStatus, progress: 55 } };
      const heartbeat = createHeartbeat(fakeJobsClient(jobs), 'j1');

      await expect(heartbeat('extracting', 60)).rejects.toBeInstanceOf(JobSupersededError);

      // Before the fix a cancelled job was flipped back to 'extracting' and later 'completed'.
      expect(jobs.j1).toEqual({ status: finalStatus, progress: 55 });
    },
  );

  it('stops a run whose job was cancelled while it was working', async () => {
    const jobs = { j1: { status: 'queued', progress: 0 } };
    const heartbeat = createHeartbeat(fakeJobsClient(jobs), 'j1');

    await heartbeat('inspecting', 10);
    jobs.j1.status = 'cancelled'; // the user pressed Retry: the frontend cancels the old job

    await expect(heartbeat('extracting', 30)).rejects.toBeInstanceOf(JobSupersededError);
    expect(jobs.j1.status).toBe('cancelled');
  });

  it('does not abort a healthy run because a heartbeat write failed transiently', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const heartbeat = createHeartbeat(fakeJobsClient({}, { message: 'connection reset' }), 'j1');

    await expect(heartbeat('extracting', 30)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('only ever writes to jobs that are still active', () => {
    // Every status the frontend treats as "in flight" must be protected, and none of the final ones.
    expect(ACTIVE_JOB_STATUSES).toEqual(expect.arrayContaining(['queued', 'inspecting', 'extracting', 'processing', 'retrying']));
    for (const final of ['completed', 'failed', 'cancelled']) {
      expect(ACTIVE_JOB_STATUSES).not.toContain(final);
    }
  });
});

/** In-memory `document_page_texts` honouring select().eq().order().range(), capped like PostgREST. */
function fakePageTextsClient(totalPages: number, maxRows = 1000) {
  const requests: Array<[number, number]> = [];
  return {
    requests,
    from: () => {
      let range: [number, number] = [0, maxRows - 1];
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        range: (from: number, to: number) => { range = [from, Math.min(to, from + maxRows - 1)]; return builder; },
        then: (resolve: (value: unknown) => unknown) => {
          requests.push(range);
          const rows = [];
          for (let page = range[0] + 1; page <= Math.min(range[1] + 1, totalPages); page += 1) {
            rows.push({ page_number: page, page_text: `text ${page}` });
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

describe('page-text checkpoint', () => {
  it('reads EVERY checkpointed page of a document with more pages than one API response holds', async () => {
    // With a single unpaginated select only the first 1000 rows come back. The extractor then
    // believes pages 1001+ were never extracted, redoes them on every run, never reaches
    // "complete", and keeps re-invoking itself forever.
    const client = fakePageTextsClient(2_500);

    const pages = await loadAllPageTexts(client, 'doc-1');

    expect(pages.size).toBe(2_500);
    expect(pages.get(1)).toBe('text 1');
    expect(pages.get(2_500)).toBe('text 2500');
    expect(client.requests).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('is a single request for a small document', async () => {
    const client = fakePageTextsClient(120);

    const pages = await loadAllPageTexts(client, 'doc-1');

    expect(pages.size).toBe(120);
    expect(client.requests).toHaveLength(1);
  });

  it('returns an empty checkpoint for a document that has none', async () => {
    const pages = await loadAllPageTexts(fakePageTextsClient(0), 'doc-1');
    expect(pages.size).toBe(0);
  });

  it('keeps what it has read when a later page of the checkpoint fails, instead of failing the job', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let calls = 0;
    const flaky = {
      from: () => {
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          range: () => builder,
          then: (resolve: (value: unknown) => unknown) => {
            calls += 1;
            const result = calls === 1
              ? { data: Array.from({ length: 1000 }, (_, i) => ({ page_number: i + 1, page_text: 't' })), error: null }
              : { data: null, error: { message: 'timeout' } };
            return Promise.resolve(result).then(resolve);
          },
        };
        return builder;
      },
    };

    const pages = await loadAllPageTexts(flaky, 'doc-1');

    expect(pages.size).toBe(1000);
    expect(warn).toHaveBeenCalled();
  });
});
