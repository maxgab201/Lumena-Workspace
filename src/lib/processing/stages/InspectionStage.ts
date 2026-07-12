import { pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface InspectionMetadata {
  pdfVersion?: string;
  pageCount: number;
  fileSizeBytes?: number;
  isScanned: boolean;
  hasNativeText: boolean;
  isEncrypted: boolean;
  metadata?: any;
}

export class InspectionStage {
  static async inspectPdf(file: File | Blob): Promise<InspectionMetadata> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(new Uint8Array(arrayBuffer)).promise;
      
      const pageCount = pdf.numPages;
      let hasNativeText = false;
      
      // We will sample a few pages (e.g. first, middle, last) to guess if it's purely scanned
      // A more robust implementation would check all pages, but for now we sample for speed.
      const samplePages = [1, Math.max(1, Math.floor(pageCount / 2)), pageCount];
      const uniqueSamples = Array.from(new Set(samplePages));
      
      for (const pageNum of uniqueSamples) {
        if (pageNum > pageCount || pageNum < 1) continue;
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        if (textContent.items.length > 0) {
          hasNativeText = true;
          break; // If we found text, we know it's not purely a scan
        }
      }

      // Check metadata
      let docMetadata = null;
      try {
        docMetadata = await pdf.getMetadata();
      } catch(_e) {
        // sometimes getting metadata throws on encrypted/corrupt docs
      }

      // Determining encryption usually happens earlier in getDocumentProxy (throws PasswordException)
      // but if we got here, we assume it's unlocked or not encrypted.
      // pdf.js provides info if it requires password
      
      return {
        pageCount,
        fileSizeBytes: file.size,
        hasNativeText,
        isScanned: !hasNativeText,
        isEncrypted: false,
        metadata: docMetadata?.info || {}
      };

    } catch (error: any) {
      console.error('Inspection failed:', error);
      if (error.name === 'PasswordException') {
        return {
          pageCount: 0,
          isEncrypted: true,
          hasNativeText: false,
          isScanned: false
        };
      }
      throw error;
    }
  }
}
