/**
 * Keyword retrieval over document_chunks, used when semantic search cannot run (the embedding
 * provider is out of quota, or the document has no embeddings). It needs no provider at all:
 * chunks are always stored, and `search_vector` is a generated, GIN-indexed tsvector.
 *
 * Pure helpers, free of Deno/URL imports so vitest can exercise them.
 */

/** Words that say nothing about what a chunk is about (English and Spanish). */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was', 'one', 'our', 'out', 'has', 'have',
  'what', 'when', 'which', 'who', 'how', 'why', 'where', 'with', 'this', 'that', 'from', 'they', 'will',
  'would', 'there', 'their', 'about', 'into', 'than', 'then', 'them', 'these', 'those', 'been', 'being',
  'does', 'did', 'doing', 'your', 'any', 'some', 'tell', 'explain', 'please',
  'que', 'los', 'las', 'del', 'por', 'con', 'una', 'uno', 'unos', 'unas', 'para', 'como', 'pero', 'sus',
  'les', 'muy', 'sin', 'sobre', 'entre', 'cuando', 'donde', 'quien', 'cual', 'cuales', 'esta', 'este',
  'esto', 'estos', 'estas', 'ese', 'esa', 'eso', 'son', 'ser', 'fue', 'han', 'hay', 'tambien', 'también',
  'explicame', 'explícame', 'dime', 'favor',
]);

/** The words of a question worth searching for: letters/digits only, no stopwords, deduplicated. */
export function keywordTerms(query: string, max = 8): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const word of words) {
    // Short words say nothing, but a short number is often the point ("page 55", "article 12").
    const tooShort = word.length < 3 && !/^\d{2}$/.test(word);
    if (tooShort || STOPWORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    terms.push(word);
    if (terms.length >= max) break;
  }
  return terms;
}

/** `to_tsquery` input. Terms are letters/digits only (see keywordTerms), so no operator can be injected. */
export const andTsQuery = (terms: string[]): string => terms.join(' & ');
export const orTsQuery = (terms: string[]): string => terms.join(' | ');

/** How well a chunk matches: distinct terms present (what matters most) plus a little for repetition. */
export function scoreChunk(text: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const lower = text.toLowerCase();
  let distinct = 0;
  let occurrences = 0;
  for (const term of terms) {
    const first = lower.indexOf(term);
    if (first < 0) continue;
    distinct += 1;
    let at = first;
    while (at >= 0 && occurrences < 50) {
      occurrences += 1;
      at = lower.indexOf(term, at + term.length);
    }
  }
  return distinct + Math.min(occurrences, 20) / 100;
}

export function rankKeywordChunks<T extends { content: string; page_number: number }>(
  chunks: T[],
  terms: string[],
  limit: number,
): Array<T & { score: number }> {
  return chunks
    .map((chunk) => ({ ...chunk, score: scoreChunk(chunk.content, terms) }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.page_number - b.page_number)
    .slice(0, limit);
}

/** document_chunks ids look like `<documentId>_p<page>_c<n>`; the retrieval contract wants a number. */
export function chunkIndexOf(id: string): number {
  const match = id.match(/_c(\d+)$/);
  return match ? Number(match[1]) : 0;
}
