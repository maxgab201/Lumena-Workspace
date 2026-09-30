/**
 * Small, dependency-free pieces of the document-processing pipeline. They live here (and
 * not inside process-document/index.ts) so vitest can exercise them without a Deno runtime.
 */

/** Job states that mean "work is still in flight". Every one is a valid `job_status` label. */
export const ACTIVE_JOB_STATUSES = [
  'queued',
  'inspecting',
  'extracting',
  'ocr',
  'layout',
  'processing',
  'retrying',
  'paused',
]

/** Thrown when the job this run belongs to was cancelled or finished by someone else. */
export class JobSupersededError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} was cancelled or finished elsewhere`)
    this.name = 'JobSupersededError'
  }
}

// Structural type: only what the helpers call, so tests can pass a plain fake.
// deno-lint-ignore no-explicit-any
type QueryClient = { from: (table: string) => any }

/**
 * Stage/progress writer for one job. Every write also refreshes `progress_heartbeat`, which
 * is how the stale-job watchdog tells a live run from a dead one.
 *
 * The write only applies while the job is still active. Before, it overwrote the status
 * unconditionally: a job the user had cancelled (Retry cancels the old one and creates a
 * new one) was resurrected as 'extracting' by the run still in flight, and later marked
 * 'completed', racing the replacement job. When no row is updated the job is gone from
 * under us, so the run must stop.
 *
 * A failed write is only logged: a transient database error must not kill a healthy run.
 */
export function createHeartbeat(client: QueryClient, jobId: string, now: () => Date = () => new Date()) {
  return async (status: string, progress: number, extra: Record<string, unknown> = {}): Promise<void> => {
    const { data, error } = await client
      .from('processing_jobs')
      .update({ status, progress, progress_heartbeat: now().toISOString(), ...extra })
      .eq('id', jobId)
      .in('status', ACTIVE_JOB_STATUSES)
      .select('id')

    if (error) {
      console.warn(`[heartbeat] job ${jobId} write failed (non-fatal): ${error.message}`)
      return
    }
    if (!data || data.length === 0) throw new JobSupersededError(jobId)
  }
}

const CHECKPOINT_PAGE_SIZE = 1000

/** Dimensions of the embedding column (gemini-embedding-001 with outputDimensionality 768). */
export const EMBEDDING_DIMENSIONS = 768

/** Fewer visible characters than this across the whole document means it has no text layer. */
const MIN_NATIVE_TEXT_CHARS = 32

/**
 * Whether a PDF carries a real text layer. It must look at the page texts themselves: the
 * stored `---PAGE n---` markers are 11+ characters each, so counting them made every scanned
 * PDF of three pages or more look like it had text (and skip the scanned-document path).
 */
export function hasNativeText(pages: string[]): boolean {
  return pages.join('').replace(/\s+/g, '').length >= MIN_NATIVE_TEXT_CHARS
}

/**
 * Separates the chunks of one storage batch into those that have a usable embedding and a
 * count of those that do not.
 *
 * A chunk whose embedding failed (provider quota, transient error) has an empty slot. Sending
 * that empty vector makes the database reject the WHOLE batch ("vector must have at least 1
 * dimension"): one failed chunk used to throw away the ~99 good ones next to it and stop every
 * later batch. Leaving the failed chunks out keeps the rest of the document searchable.
 */
export function partitionEmbedded<T>(
  chunks: T[],
  embeddings: Array<number[] | undefined>,
  offset: number,
): { indexed: Array<{ chunk: T; index: number; embedding: number[] }>; skipped: number } {
  const indexed: Array<{ chunk: T; index: number; embedding: number[] }> = []
  let skipped = 0
  chunks.forEach((chunk, i) => {
    const embedding = embeddings[offset + i]
    if (Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSIONS) {
      indexed.push({ chunk, index: offset + i, embedding })
    } else {
      skipped += 1
    }
  })
  return { indexed, skipped }
}

/**
 * Every page already extracted for a document, keyed by page number.
 *
 * PostgREST answers at most 1000 rows per request. Reading the checkpoint with one plain
 * select made every page past the 1000th look "never extracted": each chained invocation
 * re-extracted the same 80 pages, never reached "complete", and re-invoked itself forever,
 * with a fresh heartbeat each time so the watchdog never noticed.
 *
 * If a later page of the checkpoint cannot be read, what was read so far is returned:
 * extraction is idempotent (upserts), so missing pages are simply redone.
 */
export async function loadAllPageTexts(
  client: QueryClient,
  documentId: string,
  pageSize: number = CHECKPOINT_PAGE_SIZE,
): Promise<Map<number, string>> {
  const pages = new Map<number, string>()
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('document_page_texts')
      .select('page_number, page_text')
      .eq('document_id', documentId)
      .order('page_number')
      .range(from, from + pageSize - 1)

    if (error) {
      console.warn(`[checkpoint] could not read pages ${from + 1}+ of ${documentId}: ${error.message}`)
      break
    }
    for (const row of data ?? []) pages.set(row.page_number, row.page_text)
    if ((data?.length ?? 0) < pageSize) break
  }
  return pages
}
