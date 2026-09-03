import { describe, expect, it } from 'vitest';
import { applyProcessingJob, getDocumentStage, type WorkspaceDocument } from '../../src/types/documents';
import type { ProcessingJob } from '../../src/types/processing';

const document: WorkspaceDocument = {
  id: 'doc-1',
  workspace_id: 'ws-1',
  name: 'notes.pdf',
  size_bytes: 1024,
  status: 'uploading',
  file_path: 'ws-1/notes.pdf',
  created_at: '2026-09-02T00:00:00.000Z',
};

function job(status: ProcessingJob['status'], progress = 0): ProcessingJob {
  return {
    id: 'job-1',
    workspace_id: 'ws-1',
    document_id: 'doc-1',
    status,
    progress,
    created_at: '2026-09-02T00:00:00.000Z',
    updated_at: '2026-09-02T00:00:00.000Z',
  };
}

describe('document processing stages', () => {
  it.each([
    ['queued', 'uploaded'],
    ['inspecting', 'processing'],
    ['extracting', 'processing'],
    ['ocr', 'ocr'],
    ['processing', 'analyzing'],
    ['completed', 'ready'],
    ['failed', 'failed'],
  ] as const)('maps %s jobs to the %s user-facing stage', (jobStatus, expectedStage) => {
    expect(getDocumentStage(applyProcessingJob(document, job(jobStatus, 50)))).toBe(expectedStage);
  });

  it('treats the persisted ready document state as authoritative', () => {
    const staleJobDocument = {
      ...document,
      status: 'ready' as const,
      processing_status: 'processing' as const,
    };

    expect(getDocumentStage(staleJobDocument)).toBe('ready');
  });
});
