/**
 * useDocumentProcessing — React hook that observes OCR processing status.
 *
 * This hook does NOT control processing. It:
 * 1. Checks if the document needs client-side OCR
 * 2. Triggers processing via DocumentProcessingService (if needed)
 * 3. Subscribes to status changes and returns the current status
 *
 * The DocumentProcessingService is independent of React — this hook
 * is just the bridge for UI observation.
 */

import { useEffect, useState } from 'react';
import { DocumentProcessingService } from '../lib/processing/DocumentProcessingService';

export type ProcessingStatus = 'idle' | 'processing' | 'completed' | 'error';

/**
 * Observe and optionally trigger OCR processing for a document.
 *
 * @param documentId - The document to process
 * @param fileUrl - Signed URL for downloading the PDF
 * @param totalPages - Number of pages in the PDF
 * @param ocrStatus - Current ocr_status from the document record
 */
export function useDocumentProcessing(
  documentId: string | null,
  fileUrl: string | null,
  totalPages: number | null,
  ocrStatus: string | null,
) {
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!documentId || !fileUrl || !totalPages) return;
    if (ocrStatus !== 'needs_client_ocr') return;

    const service = DocumentProcessingService.getInstance(documentId);

    // Subscribe to status changes
    const unsubscribe = service.subscribe((newStatus) => {
      setStatus(newStatus);
      setIsProcessing(newStatus === 'processing');
    });

    // Trigger processing (safe to call multiple times — service deduplicates)
    service.process(fileUrl, totalPages);

    return () => {
      unsubscribe();
    };
  }, [documentId, fileUrl, totalPages, ocrStatus]);

  // Abort on unmount (user navigated away)
  useEffect(() => {
    return () => {
      if (documentId) {
        DocumentProcessingService.getInstance(documentId).abort();
      }
    };
  }, [documentId]);

  return { status, isProcessing };
}
