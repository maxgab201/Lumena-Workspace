import { pdfjs } from 'react-pdf';
import type { NormalizedRect } from '../../types/highlights';

// Vite replaces `?url` imports with a URL string at build time. In Node
// (unit tests) the setup script exposes the worker file URL on globalThis.
try {
  const bundled = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = bundled;
} catch {
  const nodeWorkerUrl = (globalThis as Record<string, unknown>).__PDFJS_WORKER_URL__;
  if (typeof nodeWorkerUrl === 'string') {
    pdfjs.GlobalWorkerOptions.workerSrc = nodeWorkerUrl;
  }
}

/**
 * Sentence inventory (Checkpoint 3 — semantic quality rework).
 *
 * The AI used to choose whole text items (≈ full lines), which forced it to
 * highlight either everything or nothing. This module gives it sentence-level
 * units backed by WORD-level real geometry:
 *
 *   PDF text item / OCR word  →  words (real rects, canonical space)
 *                             →  lines
 *                             →  sentences (stable keys, reading order)
 *
 * The AI then returns a QUOTE (an exact substring of a sentence). The client
 * maps the quote back to the exact word range and merges per-line rects —
 * multi-line quotes become multi-rect highlights. The AI still never sees or
 * produces coordinates.
 */

export interface FlowWord {
  /** Original word text (as it appears in the document). */
  text: string;
  /** Canonical unrotated normalized rect of this word. */
  rect: NormalizedRect;
  /** Line this word belongs to (0-based within its sentence flow). */
  lineIndex: number;
}

export interface Sentence {
  sentence_key: string; // "p3-S4"
  page_number: number;  // 1-based
  /** Words of the sentence, in reading order (real geometry). */
  words: FlowWord[];
  /** Original text of the sentence: words joined by single spaces. */
  text: string;
}

export interface PageSentences {
  page_number: number;
  sentences: Sentence[];
  /** Total characters across sentences (coverage math). */
  totalChars: number;
}

const MAX_WORDS_PER_SENTENCE = 60; // keep units manageable
const MIN_WORDS_PER_SENTENCE = 1;
/** Words ending with these characters close a sentence. */
const SENTENCE_END = /[.!?…]["')\]]?$/;
/** Lines whose vertical centers differ more than this (× line height) start a new line. */
const LINE_BREAK_TOLERANCE = 0.6;

export class SentenceInventory {
  // ────────────────────────────────────────────────────────────────
  // NATIVE: PDF.js text items → words → lines → sentences
  // ────────────────────────────────────────────────────────────────

  /**
   * Build sentence inventory for native pages straight from the PDF.js text
   * layer. Word rects inside a multi-word text item are distributed across
   * the item's REAL width by character proportion (the same anchoring the
   * text layer uses) — y position and item start x are exact.
   */
  static async buildNativeSentences(
    file: File | Blob,
    pages?: number[],
    onPage?: (pageNumber: number, info: { hasNativeText: boolean }) => void,
  ): Promise<{ perPage: PageSentences[]; totalPages: number; scannedPages: number[] }> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(new Uint8Array(arrayBuffer)).promise;
    const totalPages = pdf.numPages;
    const pageNumbers = pages ?? Array.from({ length: totalPages }, (_, i) => i + 1);

    const perPage: PageSentences[] = [];
    const scannedPages: number[] = [];

    for (const pageNumber of pageNumbers) {
      if (pageNumber < 1 || pageNumber > totalPages) continue;
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1, rotation: 0 });

      // 1. Text items → words with real per-item geometry
      const rawWords: Array<{
        text: string; startFrac: number; endFrac: number;
        itemX: number; itemW: number; top: number; height: number;
      }> = [];
      let nativeCharCount = 0;

      for (const item of textContent.items) {
        if (!('str' in item)) continue;
        const str = (item as { str: string }).str;
        if (!str || !str.trim()) continue;
        nativeCharCount += str.trim().length;

        const t = (item as unknown as { transform: number[] }).transform;
        const w = (item as unknown as { width: number }).width;
        const h = (item as unknown as { height: number }).height;
        const itemX = t[4];
        const top = viewport.height - t[5] - h;

        // Split the item's string into words, keeping char offsets
        const re = /\S+/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(str)) !== null) {
          rawWords.push({
            text: m[0],
            startFrac: m.index / str.length,
            endFrac: (m.index + m[0].length) / str.length,
            itemX, itemW: w, top, height: h,
          });
        }
      }

      const hasNativeText = nativeCharCount >= 32;
      onPage?.(pageNumber, { hasNativeText });
      if (!hasNativeText) {
        scannedPages.push(pageNumber);
        perPage.push({ page_number: pageNumber, sentences: [], totalChars: 0 });
        continue;
      }

      const pageSentences = SentenceInventory.wordsToSentences(rawWords, pageNumber, viewport);
      perPage.push(pageSentences);
    }

    return { perPage, totalPages, scannedPages };
  }

  // ────────────────────────────────────────────────────────────────
  // OCR: Tesseract words (real pixel bboxes) → words → sentences
  // ────────────────────────────────────────────────────────────────

  /**
   * Build sentence inventory for a scanned page from real Tesseract word
   * bboxes (already normalized to canonical space by the caller's raster).
   */
  static buildOcrSentences(
    pageNumber: number,
    ocrWords: Array<{ text: string; bbox: [number, number, number, number]; confidence: number }>,
    rasterWidth: number,
    rasterHeight: number,
  ): PageSentences {
    const rawWords = ocrWords
      .filter((w) => w.text?.trim())
      .map((w) => ({
        text: w.text.trim(),
        startFrac: 0,
        endFrac: 0,
        itemX: w.bbox[0] / rasterWidth,   // already canonical — reuse the frac fields
        itemW: (w.bbox[2] - w.bbox[0]) / rasterWidth,
        top: w.bbox[1] / rasterHeight,
        height: (w.bbox[3] - w.bbox[1]) / rasterHeight,
      }));
    return SentenceInventory.wordsToSentences(rawWords, pageNumber, null);
  }

  // ────────────────────────────────────────────────────────────────
  // Shared: words → lines → sentences (canonical FlowWord rects)
  // ────────────────────────────────────────────────────────────────

  private static wordsToSentences(
    rawWords: Array<{
      text: string; startFrac: number; endFrac: number;
      itemX: number; itemW: number; top: number; height: number;
    }>,
    pageNumber: number,
    viewport: { width: number; height: number } | null,
  ): PageSentences {
    // Native words carry fractions of a real item; OCR words carry already
    // normalized geometry. Both reduce to (x0, x1, top, height) in 0..1.
    const words: FlowWord[] = rawWords.map((rw) => {
      let x0: number, x1: number;
      if (viewport) {
        // Item geometry is in viewport units; normalize by viewport size.
        x0 = Math.max(0, Math.min(1, rw.itemX / viewport.width));
        const itemEnd = Math.max(0, Math.min(1, (rw.itemX + rw.itemW) / viewport.width));
        x1 = Math.min(itemEnd, x0 + (itemEnd - x0) * rw.endFrac);
        return {
          text: rw.text,
          rect: {
            x: Number(x0.toFixed(5)),
            y: Number(Math.max(0, rw.top / viewport.height).toFixed(5)),
            width: Number(Math.max(0.0005, x1 - x0).toFixed(5)),
            height: Number(Math.max(0.004, rw.height / viewport.height).toFixed(5)),
          },
          lineIndex: 0,
        };
      }
      return {
        text: rw.text,
        rect: {
          x: Number(Math.max(0, Math.min(1, rw.itemX)).toFixed(5)),
          y: Number(Math.max(0, Math.min(1, rw.top)).toFixed(5)),
          width: Number(Math.max(0.0005, Math.min(1, rw.itemW)).toFixed(5)),
          height: Number(Math.max(0.004, Math.min(1, rw.height)).toFixed(5)),
        },
        lineIndex: 0,
      };
    });

    // Assign line indices by vertical proximity (reading order is preserved)
    let currentLine = -1;
    let currentTop = -Infinity;
    let currentHeight = 0;
    for (const word of words) {
      const cy = word.rect.y + word.rect.height / 2;
      const isNewLine =
        currentLine < 0 ||
        Math.abs(cy - currentTop) > LINE_BREAK_TOLERANCE * Math.max(currentHeight, word.rect.height);
      if (isNewLine) {
        currentLine++;
        currentTop = cy;
        currentHeight = word.rect.height;
      }
      word.lineIndex = currentLine;
    }

    // Group words into sentences: cut after sentence-ending punctuation, or
    // when a sentence grows past MAX_WORDS_PER_SENTENCE (paragraph-ish cut on
    // a line change keeps units readable).
    const sentences: Sentence[] = [];
    let current: FlowWord[] = [];
    let seq = 0;

    const flush = () => {
      if (current.length < MIN_WORDS_PER_SENTENCE) { current = []; return; }
      sentences.push({
        sentence_key: `p${pageNumber}-S${seq}`,
        page_number: pageNumber,
        words: current,
        text: current.map((w) => w.text).join(' '),
      });
      seq++;
      current = [];
    };

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      current.push(word);
      const prevLine = word.lineIndex;
      const next = words[i + 1];

      const endsSentence = SENTENCE_END.test(word.text);
      const tooLong = current.length >= MAX_WORDS_PER_SENTENCE;
      const paragraphBreak =
        next && next.lineIndex !== prevLine &&
        Math.abs((next.rect.y) - (word.rect.y)) > word.rect.height * 1.8;

      if (endsSentence || tooLong || paragraphBreak) flush();
    }
    flush();

    const totalChars = sentences.reduce((sum, s) => sum + s.text.length, 0);
    return { page_number: pageNumber, sentences, totalChars };
  }
}

// ────────────────────────────────────────────────────────────────
// Quote matching: exact (normalized) substring → word range → rects
// ────────────────────────────────────────────────────────────────

/** Normalization for matching only — original text is never altered. */
function normalizeForMatch(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‐-―−]/g, '-') // dashes → hyphen
    .replace(/[‘’‛]/g, "'")  // curly quotes
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface QuoteMatch {
  /** 0-based inclusive start word index within the sentence. */
  startWord: number;
  /** 0-based inclusive end word index within the sentence. */
  endWord: number;
  /** Original (unnormalized) highlighted text: words joined by spaces. */
  matchedText: string;
}

/**
 * Locate `quote` inside `sentence` with STRICT matching: unicode + whitespace
 * + case normalization only. Trailing punctuation of the quote is optional.
 * Returns null when the quote genuinely doesn't exist — callers must discard
 * the selection rather than approximate.
 */
export function matchQuote(sentence: Sentence, rawQuote: string): QuoteMatch | null {
  const quote = normalizeForMatch(rawQuote);
  if (!quote) return null;

  // Precompute normalized sentence and char-offset of each word start
  const wordTexts = sentence.words.map((w) => normalizeForMatch(w.text));
  let haystack = '';
  const wordStarts: number[] = [];
  for (const wt of wordTexts) {
    wordStarts.push(haystack.length);
    haystack += wt + ' ';
  }
  haystack = haystack.trimEnd();

  let idx = haystack.indexOf(quote);
  if (idx === -1) {
    // Retry ignoring trailing punctuation on the quote (". vs nothing)
    const trimmed = quote.replace(/[.,;:!?"')\]]+$/, '');
    if (trimmed && trimmed.length >= 4) {
      idx = haystack.indexOf(trimmed);
    }
    if (idx === -1) return null;
  }

  const endChar = idx + quote.length;
  let startWord = -1;
  let endWord = -1;
  for (let i = 0; i < sentence.words.length; i++) {
    const wStart = wordStarts[i];
    const wEnd = wStart + wordTexts[i].length;
    if (startWord === -1 && wEnd > idx) startWord = i;
    if (wStart < endChar) endWord = i;
  }
  if (startWord === -1) return null;

  return {
    startWord,
    endWord: Math.max(endWord, startWord),
    matchedText: sentence.words.slice(startWord, endWord + 1).map((w) => w.text).join(' '),
  };
}

/**
 * Merge the selected words' rects into per-line rects (union per line).
 * A quote spanning 3 lines produces exactly 3 tight rects — never a box
 * around the whole paragraph.
 */
export function rectsForWordRange(words: FlowWord[], start: number, end: number): NormalizedRect[] {
  const selected = words.slice(start, end + 1);
  if (selected.length === 0) return [];

  const byLine = new Map<number, FlowWord[]>();
  for (const w of selected) {
    const list = byLine.get(w.lineIndex) ?? [];
    list.push(w);
    byLine.set(w.lineIndex, list);
  }

  const rects: NormalizedRect[] = [];
  for (const [, lineWords] of [...byLine.entries()].sort((a, b) => a[0] - b[0])) {
    const left = Math.min(...lineWords.map((w) => w.rect.x));
    const top = Math.min(...lineWords.map((w) => w.rect.y));
    const right = Math.max(...lineWords.map((w) => w.rect.x + w.rect.width));
    const bottom = Math.max(...lineWords.map((w) => w.rect.y + w.rect.height));
    rects.push({
      x: Number(left.toFixed(5)),
      y: Number(top.toFixed(5)),
      width: Number((right - left).toFixed(5)),
      height: Number((bottom - top).toFixed(5)),
    });
  }
  return rects;
}
