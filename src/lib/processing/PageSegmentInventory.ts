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
 * Page segment inventory (Checkpoint 3).
 *
 * Builds the per-page text inventory with CANONICAL geometry:
 *   - Native pages: text items come from the PDF.js text layer. Each text
 *     item carries its transform in PDF user space; we normalize it against
 *     the UNROTATED viewport (scale 1, rotation 0) so the geometry lives in
 *     the exact same canonical space as manual highlights.
 *   - Scanned pages: words come from Tesseract with pixel bboxes on the
 *     rasterized page. We normalize against the raster dimensions, which
 *     maps 1:1 to the unrotated page space (rasterization happens at
 *     rotation 0).
 *
 * The AI later selects `segment_key`s from this inventory; the client maps
 * them back to canonical rects. The AI never sees or outputs geometry.
 */

export interface PageSegment {
  segment_key: string;
  page_number: number; // 1-based
  text: string;
  rects: NormalizedRect[];
  origin: 'native' | 'ocr';
  confidence?: number | null;
  sequence: number;
}

export interface PageInventory {
  page_number: number;
  hasNativeText: boolean;
  nativeCharCount: number;
  segments: PageSegment[];
}

export interface DocumentInventoryResult {
  totalPages: number;
  nativePages: number;
  ocrPages: number;
  segments: PageSegment[];
  perPage: PageInventory[];
}

/** Minimum characters for a page to count as having a usable text layer. */
const NATIVE_TEXT_MIN_CHARS = 32;

export class PageSegmentInventory {
  /**
   * Build the segment inventory for a page range using the native PDF text
   * layer. Returns per-page info so the caller knows which pages need OCR.
   */
  static async buildNativeInventory(
    file: File | Blob,
    opts: { onPage?: (pageNumber: number, info: { hasNativeText: boolean; charCount: number }) => void; pages?: number[] } = {},
  ): Promise<{ perPage: PageInventory[]; totalPages: number; segments: PageSegment[] }> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(new Uint8Array(arrayBuffer)).promise;
    const totalPages = pdf.numPages;
    const pageNumbers = opts.pages ?? Array.from({ length: totalPages }, (_, i) => i + 1);

    const perPage: PageInventory[] = [];
    const segments: PageSegment[] = [];

    for (const pageNumber of pageNumbers) {
      if (pageNumber < 1 || pageNumber > totalPages) continue;
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      // Unrotated reference viewport: rotation 0, scale 1 → canonical space
      const canonicalViewport = page.getViewport({ scale: 1, rotation: 0 });

      let nativeCharCount = 0;
      const pageSegments: PageSegment[] = [];

      let seq = 0;
      for (const item of textContent.items) {
        // Skip marked-content separators (no str)
        if (!('str' in item)) continue;
        const str = (item as { str: string }).str;
        const trimmed = str.trim();
        if (!trimmed) continue;
        nativeCharCount += trimmed.length;

        const transform = (item as unknown as { transform: number[] }).transform;
        const width = (item as unknown as { width: number }).width;
        const height = (item as unknown as { height: number }).height;

        // PDF user-space: transform[4]=x, transform[5]=y (baseline origin).
        // Convert to canonical top-left normalized space (y flipped by the
        // unrotated viewport which is already top-down).
        const tx = transform[4];
        const ty = transform[5];
        // The text item's baseline y (PDF space, bottom-up) maps to top-down:
        const x0 = tx;
        const y0Top = canonicalViewport.height - ty - height;
        const rect: NormalizedRect = {
          x: Number(Math.max(0, x0 / canonicalViewport.width).toFixed(5)),
          y: Number(Math.max(0, y0Top / canonicalViewport.height).toFixed(5)),
          width: Number(Math.min(1, width / canonicalViewport.width).toFixed(5)),
          height: Number(Math.max(0.005, height / canonicalViewport.height).toFixed(5)),
        };

        pageSegments.push({
          segment_key: `p${pageNumber}-native-${seq}`,
          page_number: pageNumber,
          text: trimmed,
          rects: [rect],
          origin: 'native',
          confidence: null,
          sequence: seq,
        });
        seq++;
      }

      const hasNativeText = nativeCharCount >= NATIVE_TEXT_MIN_CHARS;
      const inventory: PageInventory = {
        page_number: pageNumber,
        hasNativeText,
        nativeCharCount,
        segments: pageSegments,
      };
      perPage.push(inventory);
      segments.push(...pageSegments);
      opts.onPage?.(pageNumber, { hasNativeText, charCount: nativeCharCount });
    }

    return { perPage, totalPages, segments };
  }

  /**
   * Merge OCR results for the scanned pages into the inventory format.
   * OCR words arrive with pixel bboxes on the rasterized page (rendered at
   * rotation 0), so normalization is a direct division by raster dimensions.
   */
  static buildOcrSegments(
    pageNumber: number,
    ocrWords: Array<{ text: string; bbox: [number, number, number, number]; confidence: number }>,
    rasterWidth: number,
    rasterHeight: number,
    groupLines = true,
  ): PageSegment[] {
    if (ocrWords.length === 0) return [];

    const norm = (b: [number, number, number, number]): NormalizedRect => ({
      x: Number(Math.max(0, Math.min(1, b[0] / rasterWidth)).toFixed(5)),
      y: Number(Math.max(0, Math.min(1, b[1] / rasterHeight)).toFixed(5)),
      width: Number(Math.max(0, Math.min(1, (b[2] - b[0]) / rasterWidth)).toFixed(5)),
      height: Number(Math.max(0, Math.min(1, (b[3] - b[1]) / rasterHeight)).toFixed(5)),
    });

    if (!groupLines) {
      return ocrWords.map((w, i) => ({
        segment_key: `p${pageNumber}-ocr-${i}`,
        page_number: pageNumber,
        text: w.text.trim(),
        rects: [norm(w.bbox)],
        origin: 'ocr' as const,
        confidence: w.confidence,
        sequence: i,
      })).filter((s) => s.text.length > 0);
    }

    // Group words into lines by vertical overlap of their bboxes
    const sorted = [...ocrWords].sort((a, b) => a.bbox[1] - b.bbox[1]);
    const lines: Array<{ words: typeof ocrWords; top: number; bottom: number }> = [];
    for (const word of sorted) {
      const [, y0, , y1] = word.bbox;
      const line = lines.find((l) => {
        const overlap = Math.min(l.bottom, y1) - Math.max(l.top, y0);
        return overlap > 0.5 * Math.min(l.bottom - l.top, y1 - y0);
      });
      if (line) {
        line.words.push(word);
        line.top = Math.min(line.top, y0);
        line.bottom = Math.max(line.bottom, y1);
      } else {
        lines.push({ words: [word], top: y0, bottom: y1 });
      }
    }

    // Sort words within each line left-to-right, then build line segments
    const segments: PageSegment[] = [];
    let seq = 0;
    for (const line of lines) {
      line.words.sort((a, b) => a.bbox[0] - b.bbox[0]);
      const text = line.words.map((w) => w.text.trim()).filter(Boolean).join(' ');
      if (!text) continue;
      const left = Math.min(...line.words.map((w) => w.bbox[0]));
      const right = Math.max(...line.words.map((w) => w.bbox[2]));
      const avgConfidence =
        line.words.reduce((sum, w) => sum + w.confidence, 0) / line.words.length;
      segments.push({
        segment_key: `p${pageNumber}-ocr-${seq}`,
        page_number: pageNumber,
        text,
        rects: [norm([left, line.top, right, line.bottom])],
        origin: 'ocr',
        confidence: Number((avgConfidence / 100).toFixed(3)),
        sequence: seq,
      });
      seq++;
    }
    return segments;
  }
}
