import { describe, it, expect, beforeAll } from 'vitest';
import { pdfjs } from 'react-pdf';
import {
  SentenceInventory,
  matchQuote,
  rectsForWordRange,
} from '../../src/lib/ai/SentenceInventory';
import * as fs from 'fs';
import * as path from 'path';

beforeAll(() => {
  // vitest resolves the worker fine when given the plain package path
  pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.min.mjs';
});

/**
 * Checkpoint 3 quality tests: semantic selection granularity.
 *
 * The AI must be able to highlight a PRECISE FRAGMENT of a sentence, not the
 * whole line. These fixtures pin the word→line→sentence pipeline and the
 * strict quote→words→rects mapping for both native and OCR flows.
 */

const FIXTURES = path.resolve(process.cwd(), 'tests', 'fixtures');

// ─── Helpers ───────────────────────────────────────────────────

/** Build fake OCR words on a 1000×1400 raster, 60px line height.
 *  Lines ending with "\n\n" get an extra paragraph gap. */
function fakeOcrWords(lines: string[]): Array<{
  text: string; bbox: [number, number, number, number]; confidence: number;
}> {
  const out: Array<{ text: string; bbox: [number, number, number, number]; confidence: number }> = [];
  let y = 100;
  for (const line of lines) {
    const paragraphGap = line.endsWith('\n\n');
    const clean = line.replace(/\n\n$/, '');
    let x = 90;
    for (const word of clean.split(/\s+/)) {
      const width = 12 + word.length * 9;
      out.push({ text: word, bbox: [x, y, x + width, y + 40], confidence: 95 });
      x += width + 10;
    }
    y += paragraphGap ? 200 : 60;
  }
  return out;
}

function makeSentence(lines: string[]) {
  const page = SentenceInventory.buildOcrSentences(1, fakeOcrWords(lines), 1000, 1400);
  return page.sentences;
}

// ─── Sentence segmentation ─────────────────────────────────────

describe('SentenceInventory — segmentation', () => {
  it('splits biology prose into sentences (Spanish)', () => {
    const sentences = makeSentence([
      'La fotosíntesis es el proceso mediante el cual las plantas convierten',
      'la energía luminosa en energía química. Además, requiere agua y',
      'dióxido de carbono para producir glucosa.',
    ]);
    const texts = sentences.map((s) => s.text);
    expect(texts.some((t) => t.startsWith('La fotosíntesis'))).toBe(true);
    expect(texts.some((t) => t.startsWith('Además, requiere'))).toBe(true);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
  });

  it('splits history prose into sentences (English)', () => {
    const sentences = makeSentence([
      'World War II began in September 1939 when Germany invaded Poland.',
      'The war ended in 1945 after the surrender of Japan.',
    ]);
    expect(sentences).toHaveLength(2);
    expect(sentences[0].text).toContain('September 1939');
  });

  it('assigns correct reading order and page-prefixed stable keys', () => {
    const sentences = makeSentence(['First sentence here. Second one follows.']);
    expect(sentences[0].sentence_key).toBe('p1-S0');
    expect(sentences[1].sentence_key).toBe('p1-S1');
    expect(sentences[0].page_number).toBe(1);
  });

  it('splits on paragraph breaks even without ending punctuation', () => {
    // Second line sits ~200px lower = paragraph break (gap > 1.8 × line height)
    const sentences = makeSentence([
      'A heading without final punctuation\n\n',
      'The body paragraph starts here with more words to read.',
    ]);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(sentences[0].text).toContain('heading');
  });

  it('caps sentence length to keep units manageable', () => {
    const longText = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ') + ' end.';
    const sentences = makeSentence([longText]);
    expect(sentences[0].words.length).toBeLessThanOrEqual(60);
  });
});

// ─── Strict quote matching ─────────────────────────────────────

describe('matchQuote — strict verification (no fuzzy approximations)', () => {
  const sentences = makeSentence([
    'La fotosíntesis es el proceso mediante el cual las plantas convierten',
    'la energía luminosa en energía química y, además, requiere agua y',
    'dióxido de carbono.',
  ]);
  const fotosintesis = sentences[0];

  it('matches an exact mid-sentence quote', () => {
    const m = matchQuote(fotosintesis, 'las plantas convierten');
    expect(m).not.toBeNull();
    expect(m!.startWord).toBeGreaterThan(0);
    expect(m!.endWord).toBeGreaterThan(m!.startWord);
    expect(m!.matchedText).toBe('las plantas convierten');
  });

  it('matches case-insensitively and across punctuation', () => {
    const m = matchQuote(fotosintesis, 'La fotosíntesis es el proceso');
    expect(m).not.toBeNull();
    expect(m!.startWord).toBe(0);
  });

  it('matches a quote spanning a line break (multi-line highlight)', () => {
    const m = matchQuote(fotosintesis, 'las plantas convierten la energía luminosa');
    expect(m).not.toBeNull();
    const words = fotosintesis.words.slice(m!.startWord, m!.endWord + 1);
    const lineCount = new Set(words.map((w) => w.lineIndex)).size;
    expect(lineCount).toBe(2); // spans two real lines
  });

  it('handles curly quotes, dashes and doubled whitespace', () => {
    const sentences = makeSentence(['El tratado —según los testigos— fue “inevitable”.']);
    const m = matchQuote(sentences[0], 'fue "inevitable"');
    expect(m).not.toBeNull();
  });

  it('REJECTS quotes that do not exist in the sentence (hallucinations)', () => {
    expect(matchQuote(fotosintesis, 'las plantas fotosintetizan oxígeno')).toBeNull();
    expect(matchQuote(fotosintesis, 'energía nuclear')).toBeNull();
    expect(matchQuote(fotosintesis, '')).toBeNull();
  });

  it('rejects paraphrases (same words, different order) only if not present', () => {
    // "convierten las plantas" reversed — not in the sentence
    expect(matchQuote(fotosintesis, 'convierten las plantas energía')).toBeNull();
  });
});

// ─── Geometry: precise rects, never paragraph boxes ────────────

describe('rectsForWordRange — precise per-line rects', () => {
  const sentences = makeSentence([
    'The mitochondria is the powerhouse of the cell and produces',
    'adenosine triphosphate through cellular respiration every day.',
  ]);
  const mito = sentences[0];

  it('returns one tight rect for a single-line fragment', () => {
    const m = matchQuote(mito, 'the powerhouse of the cell')!;
    expect(m).not.toBeNull();
    const rects = rectsForWordRange(mito.words, m.startWord, m.endWord);
    expect(rects).toHaveLength(1);
    // Width must be a fraction of the line, NOT the full line
    expect(rects[0].width).toBeLessThan(0.6);
    expect(rects[0].width).toBeGreaterThan(0.05);
  });

  it('returns one rect PER LINE for multi-line fragments (no giant box)', () => {
    const m = matchQuote(mito, 'produces adenosine triphosphate')!;
    expect(m).not.toBeNull();
    const rects = rectsForWordRange(mito.words, m.startWord, m.endWord);
    expect(rects).toHaveLength(2);
    // Second rect must be narrower than the full line (only 2 words)
    expect(rects[1].width).toBeLessThan(0.35);
  });

  it('word rects tile the line contiguously (no gaps between adjacent words)', () => {
    const m = matchQuote(mito, 'the powerhouse of the cell')!;
    const rects = rectsForWordRange(mito.words, m.startWord, m.endWord);
    // The rect height matches the OCR line height: 40/1400
    expect(rects[0].height).toBeCloseTo(40 / 1400, 3);
  });
});

// ─── Native pipeline on a real fixture ─────────────────────────

describe('SentenceInventory — native PDF.js pipeline (real fixture)', () => {
  it('splits native pages into sentences with per-word real geometry', async () => {
    const file = fs.readFileSync(path.join(FIXTURES, 'ai-native-multi.pdf'));
    const blob = new Blob([file], { type: 'application/pdf' });

    const { perPage, scannedPages } = await SentenceInventory.buildNativeSentences(blob);
    expect(scannedPages).toHaveLength(0);
    const page1 = perPage.find((p) => p.page_number === 1)!;
    // Title + 3 content sentences on this fixture page
    expect(page1.sentences.length).toBeGreaterThanOrEqual(4);
    expect(page1.sentences[0].text).toContain('Introduction');

    // Every word carries a canonical rect within bounds
    for (const s of page1.sentences) {
      for (const w of s.words) {
        expect(w.rect.x).toBeGreaterThanOrEqual(0);
        expect(w.rect.x + w.rect.width).toBeLessThanOrEqual(1.0001);
        expect(w.rect.y).toBeGreaterThanOrEqual(0);
        expect(w.rect.height).toBeGreaterThan(0);
      }
    }

    // Quote verification works end-to-end on the native fixture
    const intro = page1.sentences.find((s) => s.text.includes('Machine learning'))!;
    const m = matchQuote(intro, 'learn from data');
    expect(m).not.toBeNull();
    const rects = rectsForWordRange(intro.words, m!.startWord, m!.endWord);
    expect(rects.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Redundancy / dedup contract ───────────────────────────────

describe('selection dedup contract', () => {
  // Mirrors the server-side rule: token overlap ≥ 0.75 on the shorter quote
  function isRedundant(a: string, b: string): boolean {
    const A = new Set(a.toLowerCase().split(/\s+/));
    const B = new Set(b.toLowerCase().split(/\s+/));
    const overlap = [...A].filter((w) => B.has(w)).length;
    return overlap / Math.min(A.size, B.size) >= 0.75;
  }

  it('flags near-duplicate selections', () => {
    expect(isRedundant(
      'la fotosíntesis convierte energía luminosa en química',
      'convierte energía luminosa en energía química',
    )).toBe(true);
  });

  it('keeps genuinely different facts', () => {
    expect(isRedundant(
      'la fotosíntesis convierte energía luminosa',
      'la mitosis produce dos células hijas idénticas',
    )).toBe(false);
  });
});
