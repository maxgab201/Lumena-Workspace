import type { JobStatus, ProcessingJob } from './processing';

export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'error';

export type DocumentStage =
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'ocr'
  | 'analyzing'
  | 'ready'
  | 'failed';

export interface WorkspaceDocument {
  id: string;
  workspace_id: string;
  name: string;
  size_bytes: number;
  status: DocumentStatus;
  file_path: string;
  file_hash?: string | null;
  mime_type?: string | null;
  page_count?: number | null;
  created_at: string;
  updated_at?: string;
  progress?: number;
  processing_status?: JobStatus;
  processing_error?: string | null;
  processing_job_id?: string;
  thumbnail_path?: string | null;
  thumbnail_generated_at?: string | null;
}

const ACTIVE_JOB_STATUSES: JobStatus[] = [
  'queued',
  'inspecting',
  'extracting',
  'ocr',
  'layout',
  'processing',
  'retrying',
  'paused',
];

export function getDocumentStage(document: WorkspaceDocument): DocumentStage {
  // The document row is authoritative when the backend has persisted completion.
  if (document.status === 'ready') return 'ready';

  switch (document.processing_status) {
    case 'queued':
      return 'uploaded';
    case 'inspecting':
    case 'extracting':
    case 'retrying':
    case 'paused':
      return 'processing';
    case 'ocr':
      return 'ocr';
    case 'layout':
    case 'processing':
      return 'analyzing';
    case 'completed':
      return 'ready';
    case 'failed':
    case 'cancelled':
      return 'failed';
  }

  switch (document.status) {
    case 'error':
      return 'failed';
    case 'processing':
      return 'processing';
    default:
      // Document records are created only after the storage upload succeeds.
      return 'uploaded';
  }
}

export function isDocumentReady(document: WorkspaceDocument): boolean {
  return getDocumentStage(document) === 'ready';
}

export function isDocumentActive(document: WorkspaceDocument): boolean {
  if (document.processing_status) {
    return ACTIVE_JOB_STATUSES.includes(document.processing_status);
  }
  return document.status === 'uploading' || document.status === 'processing';
}

export function applyProcessingJob(
  document: WorkspaceDocument,
  job: ProcessingJob | undefined,
): WorkspaceDocument {
  if (!job) return document;

  let status = document.status;
  if (job.status === 'completed') status = 'ready';
  else if (job.status === 'failed' || job.status === 'cancelled') status = 'error';
  else if (ACTIVE_JOB_STATUSES.includes(job.status)) status = 'processing';

  return {
    ...document,
    status,
    progress: job.progress,
    processing_status: job.status,
    processing_error: job.error_message,
    processing_job_id: job.id,
  };
}
