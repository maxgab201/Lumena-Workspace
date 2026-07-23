import { pdfjs } from 'react-pdf';

export interface ExtractedPage {
  pageIndex: number;
  imageBlob: Blob;
  width: number;
  height: number;
  scale: number;
}

export class ExtractionStage {
  /**
   * Streams PDF pages one by one, rendering them to an in-memory canvas
   * and converting them to image Blobs.
   * 
   * This generator prevents memory bloat by destroying the canvas 
   * and page references immediately after yielding.
   * 
   * @param file The PDF File or Blob
   * @param scale The rendering scale (default 2.0 for higher OCR quality)
   */
  static async *streamPages(file: File | Blob, scale: number = 2.0): AsyncGenerator<ExtractedPage, void, unknown> {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load document
    const loadingTask = pdfjs.getDocument(new Uint8Array(arrayBuffer));
    const pdf = await loadingTask.promise;
    
    const pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      
      // Use OffscreenCanvas if available (better performance in workers/modern browsers),
      // otherwise fallback to standard HTMLCanvasElement.
      let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
      let context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
      
      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(viewport.width, viewport.height);
        context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      } else {
        canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        context = canvas.getContext('2d') as CanvasRenderingContext2D;
      }
      
      if (!context) {
        throw new Error('Failed to get canvas 2d context for ExtractionStage');
      }

      // Render PDF page into canvas context
      const renderContext: any = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;

      // Extract blob
      let imageBlob: Blob;
      
      if (canvas instanceof OffscreenCanvas) {
        // OffscreenCanvas uses convertToBlob
        imageBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
      } else {
        // HTMLCanvasElement uses toBlob
        imageBlob = await new Promise<Blob>((resolve, reject) => {
          (canvas as HTMLCanvasElement).toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Canvas toBlob returned null'));
            }, 
            'image/jpeg', 
            0.95
          );
        });
      }

      yield {
        pageIndex: i - 1, // 0-based indexing for internal processing
        imageBlob,
        width: viewport.width,
        height: viewport.height,
        scale
      };

      // Force cleanup
      page.cleanup();
      canvas = null;
      context = null;
    }

    // Destroy document instance to free memory completely
    await pdf.destroy();
  }

  /**
   * Extract a single page as an image blob.
   * More efficient than streamPages() when you only need one page —
   * avoids rendering all preceding pages.
   *
   * @param file The PDF File or Blob
   * @param pageIndex 0-based page index to extract
   * @param scale The rendering scale (default 2.0 for OCR quality)
   */
  static async extractPage(
    file: File | Blob,
    pageIndex: number,
    scale: number = 2.0,
  ): Promise<ExtractedPage | null> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument(new Uint8Array(arrayBuffer));
    const pdf = await loadingTask.promise;

    try {
      const pageNum = pageIndex + 1; // pdfjs uses 1-based
      if (pageNum < 1 || pageNum > pdf.numPages) return null;

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
      let context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(viewport.width, viewport.height);
        context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      } else {
        canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        context = canvas.getContext('2d') as CanvasRenderingContext2D;
      }

      if (!context) throw new Error('Failed to get canvas 2d context');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // pdfjs-dist RenderParameters requires 'canvas' property we don't use
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renderContext: any = { canvasContext: context, viewport };
      await page.render(renderContext).promise;

      let imageBlob: Blob;
      if (canvas instanceof OffscreenCanvas) {
        imageBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
      } else {
        imageBlob = await new Promise<Blob>((resolve, reject) => {
          (canvas as HTMLCanvasElement).toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null')),
            'image/jpeg',
            0.95,
          );
        });
      }

      page.cleanup();

      return {
        pageIndex,
        imageBlob,
        width: viewport.width,
        height: viewport.height,
        scale,
      };
    } finally {
      await pdf.destroy();
    }
  }
}
