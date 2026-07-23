/**
 * DocumentProcessingService — OCR processing engine for documents.
 *
 * Independent of React. Can be called from: Viewer, processing queue,
 * manual retry, Edge Function webhook, or any other consumer.
 *
 * Flow:
 * 1. Check which pages already have extracted text (resume support)
 * 2. Download PDF from signed URL
 * 3. Inspect: detect scanned vs digital
 * 4. For each pending page: extract image → OCR → persist immediately
 * 5. Mark document as completed when all pages are done
 *
 * Idempotency: UPSERT with onConflict ensures no duplicates.
 * Recovery: completed pages are skipped on restart.
 */

import { ExtractionStage } from './stages/ExtractionStage';
import { InspectionStage } from './stages/InspectionStage';
import { TextChunker } from './TextChunker';
import { supabase } from '../supabase';
import { ProviderFallback } from '../providers/ProviderFallback';
import { providerConfig } from '../providers/provider.config';
import { usePageRegistryStore } from '../../stores/pageRegistryStore';
import { EventBus } from './EventBus';
import { DocumentRepository } from '../../repositories/document.repository';
import { ChunkRepository } from '../../repositories/chunk.repository';
import { PROCESSING_LIMITS } from './constants';
import type { OCRProvider, OCRData } from '../providers/interfaces/OCRProvider';
import type { DocumentProfile, ProviderResult } from '../providers/types';

// ─── Types ─────────────────────────────────────────────────────

export interface ProcessingOptions {
  concurrency?: number;
  maxRetries?: number;
  timeoutPerPage?: number;
}

type ServiceStatus = 'idle' | 'processing' | 'completed' | 'error';

// ─── Service ───────────────────────────────────────────────────

export class DocumentProcessingService {
  private static instances = new Map<string, DocumentProcessingService>();

  private documentId: string;
  private abortController: AbortController | null = null;
  private status: ServiceStatus = 'idle';
  private listeners = new Set<(status: ServiceStatus) => void>();

  private constructor(documentId: string) {
    this.documentId = documentId;
  }

  /**
   * Get or create a service instance for a document.
   * Ensures only one instance per document (prevents duplicate processing).
   */
  static getInstance(documentId: string): DocumentProcessingService {
    if (!this.instances.has(documentId)) {
      this.instances.set(documentId, new DocumentProcessingService(documentId));
    }
    return this.instances.get(documentId)!;
  }

  /**
   * Check if a document needs client-side OCR processing.
   */
  static async needsProcessing(documentId: string): Promise<boolean> {
    const doc = await DocumentRepository.getDocument(documentId);
    return doc.ocr_status === 'needs_client_ocr';
  }

  /**
   * Main entry point. Processes OCR for all pending pages.
   * Safe to call multiple times — skips already-processed pages.
   */
  async process(
    fileUrl: string,
    totalPages: number,
    options?: ProcessingOptions,
  ): Promise<void> {
    if (this.status === 'processing') return;

    const concurrency = options?.concurrency ?? PROCESSING_LIMITS.DEFAULT_CONCURRENCY;
    const maxRetries = options?.maxRetries ?? PROCESSING_LIMITS.MAX_RETRIES_PER_PAGE;
    const timeout = options?.timeoutPerPage ?? PROCESSING_LIMITS.TIMEOUT_PER_PAGE_MS;

    this.abortController = new AbortController();
    this.setStatus('processing');

    try {
      // 1. Check which pages are already done (recovery)
      const completedPages = await this.getCompletedPages();
      const pendingPages = Array.from({ length: totalPages }, (_, i) => i)
        .filter(i => !completedPages.has(i));

      if (pendingPages.length === 0) {
        // All pages already processed — just mark as complete
        await DocumentRepository.updateOCRStatus(this.documentId, 'completed');
        this.setStatus('completed');
        return;
      }

      // 2. Download PDF
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to download PDF: ${response.status}`);
      const blob = await response.blob();

      // 3. Inspect (verify scanned vs digital)
      const inspection = await InspectionStage.inspectPdf(blob);

      // 4. Process pending pages with concurrency control
      for (let batchStart = 0; batchStart < pendingPages.length; batchStart += concurrency) {
        if (this.abortController.signal.aborted) break;

        const batch = pendingPages.slice(batchStart, batchStart + concurrency);
        await Promise.all(
          batch.map(pageIndex =>
            this.processPageWithRetry(blob, pageIndex, inspection, maxRetries, timeout)
          ),
        );
      }

      // 5. Check if all pages are now complete
      const allDone = await this.allPagesProcessed(totalPages);
      if (allDone) {
        await DocumentRepository.updateOCRStatus(this.documentId, 'completed');
        this.setStatus('completed');
        EventBus.emit('OCRCompleted', {
          jobId: this.documentId,
          data: { totalPages },
        });

        // Trigger embedding generation for new chunks
        const { count: chunkCount } = await supabase
          .from('document_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('document_id', this.documentId);

        if (chunkCount && chunkCount > 0) {
          EventBus.emit('chunks_created', {
            documentId: this.documentId,
            chunkCount,
          });
        }
      } else if (!this.abortController.signal.aborted) {
        // Some pages failed but we didn't abort — mark partial completion
        // Document stays as 'needs_client_ocr' so next open will retry
        this.setStatus('error');
      }
    } catch (error) {
      console.error(`[OCR] Failed for document ${this.documentId}:`, error);
      await DocumentRepository.updateOCRStatus(this.documentId, 'error');
      this.setStatus('error');
    }
  }

  /**
   * Abort the current processing run.
   */
  abort(): void {
    this.abortController?.abort();
    this.setStatus('idle');
  }

  /**
   * Get current processing status.
   */
  getStatus(): ServiceStatus {
    return this.status;
  }

  /**
   * Subscribe to status changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (status: ServiceStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ─── Private: Page Processing ─────────────────────────────

  private async processPageWithRetry(
    blob: Blob,
    pageIndex: number,
    inspection: { hasNativeText: boolean; pageCount: number },
    maxRetries: number,
    timeout: number,
  ): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.processPage(blob, pageIndex, inspection, timeout);
        return;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        if (isLastAttempt) {
          console.error(
            `[OCR] Page ${pageIndex} failed after ${maxRetries + 1} attempts:`,
            error,
          );
          usePageRegistryStore.getState().updatePage(pageIndex, { ocrStatus: 'error' });
        } else {
          // Brief pause before retry
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
  }

  private async processPage(
    blob: Blob,
    pageIndex: number,
    inspection: { hasNativeText: boolean; pageCount: number },
    timeout: number,
  ): Promise<void> {
    if (this.abortController?.signal.aborted) return;

    // Update UI: processing
    usePageRegistryStore.getState().updatePage(pageIndex, { ocrStatus: 'processing' });

    // Extract image for this specific page only (O(1) instead of O(N) per page)
    const extractedPage = await ExtractionStage.extractPage(blob, pageIndex, 2.0);
    const imageBlob = extractedPage?.imageBlob ?? null;

    if (!imageBlob) throw new Error(`Failed to extract image for page ${pageIndex}`);

    // OCR via provider fallback chain
    const profile: DocumentProfile = {
      isDigital: inspection.hasNativeText,
      hasImages: false,
      hasTables: false,
      hasMath: false,
      hasHandwriting: false,
      hasMultiColumn: false,
      pageCount: inspection.pageCount,
    };

    const result = await Promise.race([
      ProviderFallback.executeWithFallback<OCRProvider, ProviderResult<OCRData>>(
        providerConfig.fallbacks.ocr,
        async (provider) => provider.processPage(imageBlob!, profile),
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timeout')), timeout),
      ),
    ]);

    // Persist immediately (each page is saved as soon as it's done)
    await DocumentRepository.upsertPageText({
      document_id: this.documentId,
      page_number: pageIndex,
      raw_text: result.data.text,
      ocr_provider: result.providerId,
      confidence: result.confidence,
    });

    // Chunk the extracted text and persist chunks for full-text search
    if (result.data.text.trim().length > 0) {
      const chunker = new TextChunker(512);
      const chunks = chunker.chunk(this.documentId, pageIndex, result.data.text);
      if (chunks.length > 0) {
        await ChunkRepository.upsertBatch(chunks);
      }
    }

    // Update UI: completed
    usePageRegistryStore.getState().updatePage(pageIndex, {
      ocrStatus: 'completed',
      ocrData: result,
    });
  }

  // ─── Private: Helpers ─────────────────────────────────────

  private async getCompletedPages(): Promise<Set<number>> {
    const pages = await DocumentRepository.getPageTexts(this.documentId);
    return new Set(
      pages
        .filter(p => p.raw_text && p.raw_text.trim().length > 0)
        .map(p => p.page_number),
    );
  }

  private async allPagesProcessed(totalPages: number): Promise<boolean> {
    const completed = await this.getCompletedPages();
    return completed.size >= totalPages;
  }

  private setStatus(status: ServiceStatus): void {
    this.status = status;
    this.listeners.forEach(l => l(status));
  }
}
