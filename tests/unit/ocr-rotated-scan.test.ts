import { describe, expect, it } from 'vitest';
import { rectToCanonical, type RightAngle } from '../../src/lib/pageRotation';
import { SentenceInventory } from '../../src/lib/ai/SentenceInventory';
import { HighlightEngine } from '../../src/lib/processing/HighlightEngine';
import { PageSegmentInventory } from '../../src/lib/processing/PageSegmentInventory';

/**
 * Production break test (real browser, QA account): a scan stored sideways with /Rotate 90 (what
 * scanner apps produce so that viewers show it upright) got garbage from OCR (16 junk segments, no
 * known word) while the same scan stored upright was read perfectly: the OCR rasterised every page at
 * rotation 0, so Tesseract saw sideways pixels. OCR now reads the page as a viewer shows it. Lines
 * and sentences are worked out there (text runs horizontally); only the finished rects go back to
 * the unrotated frame that every stored rect uses.
 */

const ANGLES: RightAngle[] = [0, 90, 180, 270];

describe('rectToCanonical', () => {
  it('leaves an unrotated page untouched', () => {
    const rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.05 };
    expect(rectToCanonical(rect, 0)).toEqual(rect);
  });

  it('is the exact inverse of how the highlight overlay draws stored rects, for every rotation', () => {
    const rects = [
      { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
      { x: 0.55, y: 0.7, width: 0.2, height: 0.02 },
      { x: 0, y: 0, width: 1, height: 1 },
    ];

    for (const angle of ANGLES) {
      for (const stored of rects) {
        const [drawn] = HighlightEngine.canonicalRectsToRendered([stored], angle);

        const back = rectToCanonical(drawn, angle);

        expect(back.x, `x at ${angle}`).toBeCloseTo(stored.x, 9);
        expect(back.y, `y at ${angle}`).toBeCloseTo(stored.y, 9);
        expect(back.width, `width at ${angle}`).toBeCloseTo(stored.width, 9);
        expect(back.height, `height at ${angle}`).toBeCloseTo(stored.height, 9);
      }
    }
  });

  it('puts the top-left of an upright /Rotate 90 page at the bottom-left of the sideways page', () => {
    // The sheet was turned 90 degrees clockwise to show it, so its top-left corner is the
    // unrotated page's bottom-left corner.
    const corner = rectToCanonical({ x: 0, y: 0, width: 0.2, height: 0.05 }, 90);

    expect(corner.x).toBeCloseTo(0);
    expect(corner.width).toBeCloseTo(0.05);
    expect(corner.y).toBeCloseTo(0.8);
    expect(corner.height).toBeCloseTo(0.2);
  });
});

/** Three lines of words as Tesseract reports them on the UPRIGHT raster (1400 x 1000, landscape). */
function uprightWords() {
  const word = (text: string, x0: number, y0: number, x1: number, y1: number) => ({ text, bbox: [x0, y0, x1, y1] as [number, number, number, number], confidence: 95 });
  return [
    word('Solar', 100, 100, 260, 150), word('power', 280, 100, 430, 150), word('grew.', 450, 100, 600, 150),
    word('Wind', 100, 220, 240, 270), word('farms', 260, 220, 420, 270), word('expand.', 440, 220, 640, 270),
    word('Storage', 100, 340, 300, 390), word('is', 320, 340, 360, 390), word('next.', 380, 340, 520, 390),
  ];
}

describe('OCR segments of a page drawn at /Rotate 90', () => {
  const upright = PageSegmentInventory.buildOcrSegments(1, uprightWords(), 1400, 1000);
  const rotated = PageSegmentInventory.buildOcrSegments(1, uprightWords(), 1400, 1000, true, 90);

  it('reads lines in order, one per printed line (not scrambled across the sideways rows)', () => {
    expect(rotated.map((segment) => segment.text)).toEqual([
      'Solar power grew.',
      'Wind farms expand.',
      'Storage is next.',
    ]);
    expect(rotated.map((segment) => segment.text)).toEqual(upright.map((segment) => segment.text));
  });

  it('stores each line rect on the unrotated page, where the displayed rect lands exactly on the line', () => {
    rotated.forEach((segment, index) => {
      const [stored] = segment.rects;
      const [drawn] = HighlightEngine.canonicalRectsToRendered([stored], 90);
      const [expected] = upright[index].rects;

      expect(drawn.x).toBeCloseTo(expected.x, 4);
      expect(drawn.y).toBeCloseTo(expected.y, 4);
      expect(drawn.width).toBeCloseTo(expected.width, 4);
      expect(drawn.height).toBeCloseTo(expected.height, 4);
    });
  });

  it('keeps every rect inside the page', () => {
    for (const rect of rotated.flatMap((segment) => segment.rects)) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1.00001);
      expect(rect.y + rect.height).toBeLessThanOrEqual(1.00001);
    }
  });

  it('is unchanged for an unrotated page (the default)', () => {
    expect(PageSegmentInventory.buildOcrSegments(1, uprightWords(), 1400, 1000, true, 0)).toEqual(upright);
  });
});

describe('OCR sentences of a page drawn at /Rotate 90', () => {
  const upright = SentenceInventory.buildOcrSentences(1, uprightWords(), 1400, 1000);
  const rotated = SentenceInventory.buildOcrSentences(1, uprightWords(), 1400, 1000, 90);

  it('builds the same sentences, in reading order', () => {
    expect(rotated.sentences.map((sentence) => sentence.text)).toEqual(upright.sentences.map((sentence) => sentence.text));
    expect(rotated.sentences.map((sentence) => sentence.text)).toEqual(['Solar power grew.', 'Wind farms expand.', 'Storage is next.']);
  });

  it('keeps the line each word belongs to, so a quote still gets one tight rect per printed line', () => {
    expect(rotated.sentences.map((sentence) => sentence.words.map((word) => word.lineIndex))).toEqual(
      upright.sentences.map((sentence) => sentence.words.map((word) => word.lineIndex)),
    );
  });

  it('draws every word back exactly where it was read', () => {
    rotated.sentences.forEach((sentence, s) => {
      sentence.words.forEach((word, w) => {
        const [drawn] = HighlightEngine.canonicalRectsToRendered([word.rect], 90);
        const expected = upright.sentences[s].words[w].rect;

        expect(drawn.x).toBeCloseTo(expected.x, 4);
        expect(drawn.y).toBeCloseTo(expected.y, 4);
        expect(drawn.width).toBeCloseTo(expected.width, 4);
        expect(drawn.height).toBeCloseTo(expected.height, 4);
      });
    });
  });

  it('is unchanged for an unrotated page (the default)', () => {
    expect(SentenceInventory.buildOcrSentences(1, uprightWords(), 1400, 1000, 0)).toEqual(upright);
  });
});
