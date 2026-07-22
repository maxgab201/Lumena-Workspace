/**
 * Processing limits and configuration for document processing.
 *
 * These values control the behavior of DocumentProcessingService
 * and can be adjusted based on deployment tier or device capabilities.
 */
export const PROCESSING_LIMITS = {
  /** Number of pages to process in parallel (default: 2) */
  DEFAULT_CONCURRENCY: 2,

  /** Maximum allowed concurrency (default: 4) */
  MAX_CONCURRENCY: 4,

  /** Timeout per page in milliseconds (default: 30s) */
  TIMEOUT_PER_PAGE_MS: 30_000,

  /** Number of retries per failed page (default: 2) */
  MAX_RETRIES_PER_PAGE: 2,

  /** Maximum documents processing simultaneously (default: 2) */
  CONCURRENT_DOCUMENTS: 2,
} as const;
