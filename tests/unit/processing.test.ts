import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/lib/processing/EventBus';
import { JobQueue } from '../../src/lib/processing/JobQueue';
import { ProviderRegistry } from '../../src/lib/processing/ProviderRegistry';

// Mock Supabase
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'mock-db-id', workspace_id: 'ws-1', document_id: 'doc-1', status: 'queued', progress: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            error: null
          })
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      }))
    }))
  }
}));

describe('Processing Infrastructure', () => {
  beforeEach(() => {
    // Clear EventBus
    // @ts-ignore
    EventBus.listeners = {};
    // @ts-ignore - clear private map for tests
    JobQueue.activeJobs.clear();
  });

  describe('EventBus', () => {
    it('should subscribe and emit events', () => {
      const callback = vi.fn();
      EventBus.on('JobStatusChanged', callback);
      
      const payload = { jobId: '1', status: 'inspecting' as const, job: {} as any };
      EventBus.emit('JobStatusChanged', payload);
      
      expect(callback).toHaveBeenCalledWith(payload);
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      EventBus.on('DocumentUploaded', callback);
      EventBus.off('DocumentUploaded', callback);
      
      EventBus.emit('DocumentUploaded', { workspaceId: 'w1', documentId: 'd1', file: new File([], '') });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('JobQueue', () => {
    it('should enqueue a job and emit event', async () => {
      const callback = vi.fn();
      EventBus.on('JobStatusChanged', callback);

      const job = await JobQueue.enqueue('ws-1', 'doc-1');
      
      expect(job.status).toBe('queued');
      expect(JobQueue.getAllJobs().length).toBe(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        jobId: job.id,
        status: 'queued'
      }));
    });

    it('should update job status and emit event', async () => {
      const job = await JobQueue.enqueue('ws-1', 'doc-1');
      const callback = vi.fn();
      EventBus.on('JobStatusChanged', callback);

      await JobQueue.updateStatus(job.id, 'inspecting', 50);

      const updated = JobQueue.getJob(job.id);
      expect(updated?.status).toBe('inspecting');
      expect(updated?.progress).toBe(50);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        jobId: job.id,
        status: 'inspecting'
      }));
    });

    it('should cancel a job', async () => {
      const job = await JobQueue.enqueue('ws-1', 'doc-1');
      const callback = vi.fn();
      EventBus.on('JobCancelled', callback);

      await JobQueue.cancel(job.id);

      const updated = JobQueue.getJob(job.id);
      expect(updated?.status).toBe('cancelled');
      expect(callback).toHaveBeenCalledWith({ jobId: job.id });
    });
  });

  describe('ProviderRegistry', () => {
    it('should register and retrieve providers', () => {
      const mockOcr = {
        getMetadata: () => ({
          id: 'mock-ocr-1',
          name: 'MockOCR',
          version: '1.0.0',
          type: 'ocr' as const,
          description: 'A mock OCR provider',
          capabilities: ['text']
        })
      };

      ProviderRegistry.registerProvider(mockOcr);
      expect(ProviderRegistry.getProvider('mock-ocr-1')).toBe(mockOcr);
      
      const allOcr = ProviderRegistry.getProvidersByType('ocr');
      expect(allOcr.length).toBe(1);
      expect(allOcr[0].name).toBe('MockOCR');
    });
  });
});
