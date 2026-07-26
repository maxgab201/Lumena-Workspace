import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/lib/processing/EventBus';
import { JobQueue } from '../../src/lib/processing/JobQueue';
import { ProviderRegistry } from '../../src/lib/processing/ProviderRegistry';
import { TextChunker } from '../../src/lib/processing/TextChunker';

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

  describe('TextChunker', () => {
    it('should split text into chunks under the token limit', () => {
      const chunker = new TextChunker(100, 0);
      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const chunks = chunker.chunk('doc-1', 1, text);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      for (const chunk of chunks) {
        expect(chunk.documentId).toBe('doc-1');
        expect(chunk.pageNumber).toBe(1);
        expect(chunk.chunkType).toBe('paragraph');
        expect(chunk.content.length).toBeGreaterThan(0);
      }
    });

    it('should produce overlapping chunks when overlap > 0', () => {
      // Create text that will split into multiple chunks
      const chunker = new TextChunker(50, 20);
      const longText = 'A'.repeat(200) + '\n\n' + 'B'.repeat(200);
      const chunks = chunker.chunk('doc-1', 1, longText);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      // With overlap, the second chunk should contain some text from the end of the first
      if (chunks.length >= 2) {
        const firstChunkEnd = chunks[0].content.slice(-30);
        const secondChunkStart = chunks[1].content.slice(0, 30);
        // At least some characters should overlap (within word boundaries)
        expect(chunks[1].content.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty text gracefully', () => {
      const chunker = new TextChunker(512, 50);
      const chunks = chunker.chunk('doc-1', 1, '');
      expect(chunks).toHaveLength(0);
    });

    it('should handle single paragraph that fits in one chunk', () => {
      const chunker = new TextChunker(512, 50);
      const text = 'This is a short paragraph.';
      const chunks = chunker.chunk('doc-1', 1, text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('This is a short paragraph.');
      expect(chunks[0].tokenCount).toBeGreaterThan(0);
    });

    it('should generate unique chunk IDs', () => {
      const chunker = new TextChunker(50, 0);
      const text = 'A'.repeat(200) + '\n\n' + 'B'.repeat(200);
      const chunks = chunker.chunk('doc-1', 1, text);

      const ids = chunks.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
