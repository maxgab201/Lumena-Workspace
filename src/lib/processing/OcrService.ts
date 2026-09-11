import { pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker, type Worker } from 'tesseract.js';
import { PageSegmentInventory, type PageSegment } from './PageSegmentInventory';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * OCR Service (Checkpoint 3) — REAL OCR, end to end.
 *
 * Architecture: the browser rasterizes scanned pages with PDF.js
 * (OffscreenCanvas at rotation 0, scale 2) and runs Tesseract.js WASM
 * locally. Words are grouped into lines, bboxes are normalized to the
 * canonical unrotated page space, and the resulting segments are persisted
 * to document_page_segments — the same table the native inventory uses.
 *
 * Why client-side: the rasterizer must be a real PDF renderer; pdf-lib
 * cannot rasterize. The Edge/Deno runtime has no DOM canvas for reliable
 * rendering, and PDF.js already ships in the client bundle. Tesseract.js
 * runs in a WASM worker — no server cost, no image upload of user content.
 */

export interface OcrPageResult {
  page_number: number;
  success: boolean;
  segmentCount: number;
  error?: string;
  confidence?: number;
  /** Real OCR words with pixel bboxes on the page raster (canonical input). */
  words?: Array<{ text: string; bbox: [number, number, number, number]; confidence: number }>;
  rasterWidth?: number;
  rasterHeight?: number;
}

export interface OcrProgress {
  phase: 'rasterizing' | 'recognizing';
  page_number: number;
  totalPages: number;
  completedPages: number;
}

type ProgressCallback = (progress: OcrProgress) => void;

const OCR_RENDER_SCALE = 2.0;
const MIN_WORD_CONFIDENCE = 30; // drop obvious garbage words

/** Flatten Tesseract v7 block hierarchy into a flat word list with bboxes. */
function flattenTesseractWords(data: unknown): Array<{
  text: string; bbox: [number, number, number, number]; confidence: number;
}> {
  const out: Array<{ text: string; bbox: [number, number, number, number]; confidence: number }> = [];
  for (const block of (data as {
    blocks?: Array<{
      paragraphs?: Array<{
        lines?: Array<{
          words?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }>;
        }>;
      }>;
    }> | null
  }).blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          if (word.text?.trim() && typeof word.confidence === 'number') {
            out.push({
              text: word.text,
              bbox: [word.bbox.x0, word.bbox.y0, word.bbox.x1, word.bbox.y1],
              confidence: word.confidence,
            });
          }
        }
      }
    }
  }
  return out;
}

/** Loose JSON type matching Supabase's Json for canonical rect arrays. */
type supabase_json = string | number | boolean | null | supabase_json[] | { [key: string]: supabase_json };

export class OcrService {
  private static worker: Worker | null = null;
  private static workerLang: string | null = null;

  private static async getWorker(lang = 'eng+spa'): Promise<Worker> {
    if (this.worker && this.workerLang === lang) return this.worker;
    if (this.worker) {
      await this.worker.terminate().catch(() => undefined);
      this.worker = null;
    }
    // logger: undefined keeps default; we surface progress via callbacks
    this.worker = await createWorker(lang);
    this.workerLang = lang;
    return this.worker;
  }

  static async dispose(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate().catch(() => undefined);
      this.worker = null;
      this.workerLang = null;
    }
  }

  /** Rasterize one page at rotation 0 and return the canvas + dimensions. */
  private static async rasterizePage(
    pdf: { getPage: (n: number) => Promise<any> },
    pageNumber: number,
  ): Promise<{ data: ImageData; width: number; height: number }> {
    const page = await pdf.getPage(pageNumber);
    // Rotation 0 → raster maps 1:1 to canonical (unrotated) page space
    const viewport = page.getViewport({ scale: OCR_RENDER_SCALE, rotation: 0 });
    const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    // White background — Tesseract performs poorly on transparency
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    return { data, width: canvas.width, height: canvas.height };
  }

  /**
   * Run OCR over the given pages and return REAL word-level results (text +
   * pixel bboxes + confidence) without persisting. Used by the sentence
   * inventory for precise sub-sentence highlighting.
   */
  static async ocrWordsForPages(
    file: File | Blob,
    pageNumbers: number[],
    onProgress?: ProgressCallback,
  ): Promise<OcrPageResult[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(new Uint8Array(arrayBuffer)).promise;
    const results: OcrPageResult[] = [];
    let completed = 0;
    const worker = await this.getWorker();

    for (const pageNumber of pageNumbers) {
      try {
        onProgress?.({ phase: 'rasterizing', page_number: pageNumber, totalPages: pageNumbers.length, completedPages: completed });
        const { data: raster, width, height } = await this.rasterizePage(pdf, pageNumber);
        onProgress?.({ phase: 'recognizing', page_number: pageNumber, totalPages: pageNumbers.length, completedPages: completed });

        const encodeCanvas = new OffscreenCanvas(width, height);
        encodeCanvas.getContext('2d')!.putImageData(raster, 0, 0);
        const pngBlob = await encodeCanvas.convertToBlob({ type: 'image/png' });

        // v7 returns only `text` unless outputs are requested explicitly.
        const { data } = await worker.recognize(pngBlob, {}, { text: true, blocks: true });

        const words = flattenTesseractWords(data).filter((w) => w.confidence >= MIN_WORD_CONFIDENCE);
        completed++;
        results.push({
          page_number: pageNumber,
          success: true,
          segmentCount: words.length,
          confidence: (data as { confidence?: number }).confidence
            ? Number(((data as { confidence?: number }).confidence! / 100).toFixed(3))
            : undefined,
          words,
          rasterWidth: width,
          rasterHeight: height,
        });
      } catch (err) {
        console.error(`[OcrService] Page ${pageNumber} failed:`, err);
        completed++;
        results.push({
          page_number: pageNumber,
          success: false,
          segmentCount: 0,
          error: err instanceof Error ? err.message : 'Unknown OCR error',
        });
      }
    }
    return results;
  }

  /**
   * Persist OCR word groups as line segments (canonical geometry) to
   * document_page_segments for observability/debugging. Non-fatal on failure.
   */
  static async persistOcrSegments(
    documentId: string,
    workspaceId: string,
    results: OcrPageResult[],
  ): Promise<void> {
    const { supabase } = await import('../supabase');
    const { PageSegmentInventory } = await import('./PageSegmentInventory');
    for (const r of results) {
      if (!r.success || !r.words || !r.rasterWidth || !r.rasterHeight) continue;
      const segments = PageSegmentInventory.buildOcrSegments(
        r.page_number, r.words, r.rasterWidth, r.rasterHeight,
      );
      if (segments.length === 0) continue;
      const rows = segments.map((s) => ({
        document_id: documentId,
        workspace_id: workspaceId,
        page_number: s.page_number,
        segment_key: s.segment_key,
        text: s.text,
        rects: s.rects as unknown as supabase_json,
        origin: s.origin,
        confidence: s.confidence,
        sequence: s.sequence,
      }));
      const { error } = await supabase
        .from('document_page_segments')
        .upsert(rows, { onConflict: 'document_id,segment_key' });
      if (error) console.error('[OcrService] persistOcrSegments failed:', error.message);
    }
  }

  /**
   * Run OCR over the given pages of a PDF file and persist the resulting
   * line segments (with canonical geometry) to document_page_segments.
   * Returns per-page results so the UI can report partial failures.
   */
  static async ocrPages(
    file: File | Blob,
    documentId: string,
    workspaceId: string,
    pageNumbers: number[],
    onProgress?: ProgressCallback,
  ): Promise<OcrPageResult[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(new Uint8Array(arrayBuffer)).promise;

    const { supabase } = await import('../supabase');
    const results: OcrPageResult[] = [];
    let completed = 0;

    const worker = await this.getWorker();

    for (const pageNumber of pageNumbers) {
      try {
        onProgress?.({
          phase: 'rasterizing',
          page_number: pageNumber,
          totalPages: pageNumbers.length,
          completedPages: completed,
        });

        const { data: raster, width, height } = await this.rasterizePage(pdf, pageNumber);

        onProgress?.({
          phase: 'recognizing',
          page_number: pageNumber,
          totalPages: pageNumbers.length,
          completedPages: completed,
        });

        // Tesseract.js reads PNG/JPEG buffers, not raw ImageData. Encode the
        // rasterized page to PNG via OffscreenCanvas.convertToBlob.
        const encodeCanvas = new OffscreenCanvas(width, height);
        encodeCanvas.getContext('2d')!.putImageData(raster, 0, 0);
        const pngBlob = await encodeCanvas.convertToBlob({ type: 'image/png' });

        // v7 returns only `text` unless outputs are requested explicitly.
        // `blocks` gives word-level bboxes + confidence.
        const { data } = await worker.recognize(pngBlob, {}, {
          text: true,
          blocks: true,
        });

        const rawWords = flattenTesseractWords(data);

        const words = rawWords.filter((w) => w.confidence >= MIN_WORD_CONFIDENCE);

        const segments: PageSegment[] = PageSegmentInventory.buildOcrSegments(
          pageNumber, words, width, height,
        );

        // Persist segments (upsert keeps idempotent retries clean)
        if (segments.length > 0) {
          const rows = segments.map((s) => ({
            document_id: documentId,
            workspace_id: workspaceId,
            page_number: s.page_number,
            segment_key: s.segment_key,
            text: s.text,
            rects: s.rects as unknown as supabase_json,
            origin: s.origin,
            confidence: s.confidence,
            sequence: s.sequence,
          }));
          const { error } = await supabase
            .from('document_page_segments')
            .upsert(rows, { onConflict: 'document_id,segment_key' });
          if (error) throw new Error(`Failed to save OCR text: ${error.message}`);
        }

        completed++;
        results.push({
          page_number: pageNumber,
          success: true,
          segmentCount: segments.length,
          confidence: data.confidence ? Number((data.confidence / 100).toFixed(3)) : undefined,
        });
      } catch (err) {
        console.error(`[OcrService] Page ${pageNumber} failed:`, err);
        completed++;
        results.push({
          page_number: pageNumber,
          success: false,
          segmentCount: 0,
          error: err instanceof Error ? err.message : 'Unknown OCR error',
        });
      }
    }

    return results;
  }
}
