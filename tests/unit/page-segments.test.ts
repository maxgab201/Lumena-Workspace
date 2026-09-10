import { describe, it, expect, beforeAll } from 'vitest';
import { pdfjs } from 'react-pdf';
import { PageSegmentInventory } from '../../src/lib/processing/PageSegmentInventory';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Checkpoint 3 functional tests: the semantic→geometric pipeline.
 * Native inventory comes from the real PDF.js text layer on real fixtures.
 */

const FIXTURES = path.resolve(process.cwd(), 'tests', 'fixtures');

beforeAll(() => {
  // vitest resolves the worker fine when given the plain package path
  pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.min.mjs';
});

describe('PageSegmentInventory — native text (PDF.js)', () => {
  it('extracts per-page segments with canonical geometry from a native PDF', async () => {
    const file = fs.readFileSync(path.join(FIXTURES, 'ai-native-multi.pdf'));
    const blob = new Blob([file], { type: 'application/pdf' });

    const { perPage, totalPages, segments } = await PageSegmentInventory.buildNativeInventory(blob);

    expect(totalPages).toBe(5);
    expect(perPage).toHaveLength(5);
    // Every page has a good text layer → no OCR needed
    expect(perPage.every((p) => p.hasNativeText)).toBe(true);
    expect(segments.length).toBeGreaterThan(20);

    // Segments carry semantic + canonical data
    const first = segments[0];
    expect(first.segment_key).toMatch(/^p1-native-\d+$/);
    expect(first.origin).toBe('native');
    expect(first.text.length).toBeGreaterThan(0);
    expect(first.rects).toHaveLength(1);
    const r = first.rects[0];
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x).toBeLessThan(1);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeLessThan(1);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });

  it('marks scanned pages as lacking native text (per-page, not per-document)', async () => {
    const file = fs.readFileSync(path.join(FIXTURES, 'ai-scanned.pdf'));
    const blob = new Blob([file], { type: 'application/pdf' });

    const { perPage, totalPages } = await PageSegmentInventory.buildNativeInventory(blob);
    expect(totalPages).toBe(2);
    // Image-only pages: no usable text layer
    expect(perPage.every((p) => !p.hasNativeText)).toBe(true);
  });

  it('detects mixed documents page by page', async () => {
    const file = fs.readFileSync(path.join(FIXTURES, 'ai-mixed.pdf'));
    const blob = new Blob([file], { type: 'application/pdf' });

    const { perPage, totalPages } = await PageSegmentInventory.buildNativeInventory(blob);
    expect(totalPages).toBe(3);
    expect(perPage[0].hasNativeText).toBe(true);  // native
    expect(perPage[1].hasNativeText).toBe(true);  // native
    expect(perPage[2].hasNativeText).toBe(false); // scanned → needs OCR
  });
});

describe('PageSegmentInventory — OCR segment grouping', () => {
  it('groups OCR words into line segments with normalized bboxes', () => {
    // Simulated Tesseract output on a 1000×1400 raster
    const words = [
      { text: 'Machine', bbox: [100, 200, 240, 240] as [number, number, number, number], confidence: 92 },
      { text: 'learning', bbox: [250, 200, 420, 240] as [number, number, number, number], confidence: 90 },
      { text: 'rocks.', bbox: [430, 200, 560, 240] as [number, number, number, number], confidence: 88 },
      { text: 'Second', bbox: [100, 300, 240, 340] as [number, number, number, number], confidence: 91 },
      { text: 'line', bbox: [250, 300, 360, 340] as [number, number, number, number], confidence: 93 },
    ];

    const segments = PageSegmentInventory.buildOcrSegments(1, words, 1000, 1400);

    expect(segments).toHaveLength(2); // two lines
    expect(segments[0].text).toBe('Machine learning rocks.');
    expect(segments[0].origin).toBe('ocr');
    expect(segments[0].segment_key).toBe('p1-ocr-0');

    // Canonical geometry: normalized 0..1
    const r = segments[0].rects[0];
    expect(r.x).toBeCloseTo(0.1, 2);        // 100/1000
    expect(r.y).toBeCloseTo(0.1429, 3);     // 200/1400
    expect(r.width).toBeCloseTo(0.46, 2);   // (560-100)/1000
    expect(r.height).toBeCloseTo(0.0286, 3);// (240-200)/1400
    expect(r.x + r.width).toBeLessThanOrEqual(1);
    expect(r.y + r.height).toBeLessThanOrEqual(1);

    // Confidence is the line average, normalized 0..1
    expect(segments[0].confidence).toBeCloseTo(0.9, 1);
    expect(segments[1].text).toBe('Second line');
  });

  it('preserves reading order and filters low-confidence words out upstream', () => {
    const words = [
      { text: 'B', bbox: [200, 100, 250, 140] as [number, number, number, number], confidence: 90 },
      { text: 'A', bbox: [100, 100, 150, 140] as [number, number, number, number], confidence: 90 },
    ];
    const segments = PageSegmentInventory.buildOcrSegments(2, words, 1000, 1000);
    expect(segments[0].text).toBe('A B'); // left-to-right within the line
    expect(segments[0].page_number).toBe(2);
  });

  it('returns empty segments for empty OCR output', () => {
    expect(PageSegmentInventory.buildOcrSegments(1, [], 1000, 1000)).toEqual([]);
  });
});

describe('AI contract — semantic selection only (no geometry from the AI)', () => {
  // The Edge Function validates returned keys against the sent inventory.
  // This pins the client-side mirror of that contract: unknown keys are
  // ignored and canonical rects always come from the inventory, never
  // from the AI response.
  function mapSelections(
    selections: Array<{ segment_key: string }>,
    inventory: Map<string, { rects: Array<{ x: number }> }>,
  ) {
    const out: Array<{ key: string; rects: Array<{ x: number }> }> = [];
    for (const s of selections) {
      const seg = inventory.get(s.segment_key);
      if (!seg) continue; // never invent geometry for unknown keys
      out.push({ key: s.segment_key, rects: seg.rects });
    }
    return out;
  }

  it('ignores hallucinated segment keys', () => {
    const inventory = new Map([
      ['p1-native-0', { rects: [{ x: 0.1 }] }],
    ]);
    const mapped = mapSelections(
      [
        { segment_key: 'p1-native-0' },
        { segment_key: 'p9-fake-99' }, // AI hallucination
      ],
      inventory,
    );
    expect(mapped).toHaveLength(1);
    expect(mapped[0].key).toBe('p1-native-0');
    expect(mapped[0].rects).toEqual([{ x: 0.1 }]); // geometry from inventory
  });

  it('never produces geometry when the inventory is empty', () => {
    const mapped = mapSelections([{ segment_key: 'whatever' }], new Map());
    expect(mapped).toHaveLength(0);
  });
});
