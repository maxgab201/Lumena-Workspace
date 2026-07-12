import type { ProcessingJob, JobStatus } from '../../types/processing';
import { EventBus } from './EventBus';
import { supabase } from '../../lib/supabase'; // Assuming there is a supabase client exported

class JobQueueImpl {
  private activeJobs: Map<string, ProcessingJob> = new Map();

  async enqueue(workspaceId: string, documentId: string): Promise<ProcessingJob> {
    const newJob: ProcessingJob = {
      id: crypto.randomUUID(), // Will be overridden by DB but good for immediate local state
      workspace_id: workspaceId,
      document_id: documentId,
      status: 'queued',
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('processing_jobs')
        .insert({
          workspace_id: workspaceId,
          document_id: documentId,
          status: 'queued',
          progress: 0,
        })
        .select()
        .single();

      if (error) throw error;
      
      const job = data as ProcessingJob;
      this.activeJobs.set(job.id, job);
      EventBus.emit('JobStatusChanged', { jobId: job.id, status: 'queued', job });
      return job;
    } catch (error) {
      console.error('Failed to enqueue job in DB, falling back to local only:', error);
      this.activeJobs.set(newJob.id, newJob);
      EventBus.emit('JobStatusChanged', { jobId: newJob.id, status: 'queued', job: newJob });
      return newJob;
    }
  }

  async updateStatus(jobId: string, status: JobStatus, progress: number = 0, errorDetails?: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.progress = progress;
    if (errorDetails) job.error_details = errorDetails;
    job.updated_at = new Date().toISOString();

    try {
      await supabase
        .from('processing_jobs')
        .update({ status, progress, error_details: errorDetails, updated_at: job.updated_at })
        .eq('id', jobId);
    } catch (error) {
      console.error(`Failed to update DB for job ${jobId}`, error);
    }

    EventBus.emit('JobStatusChanged', { jobId, status, job });
  }

  async cancel(jobId: string): Promise<void> {
    await this.updateStatus(jobId, 'cancelled');
    EventBus.emit('JobCancelled', { jobId });
  }

  async pause(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (job && (job.status === 'queued' || job.status === 'inspecting' || job.status === 'extracting' || job.status === 'ocr' || job.status === 'layout')) {
      await this.updateStatus(jobId, 'paused', job.progress);
    }
  }

  async resume(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'paused') {
      // Logic to determine which state it was in before would go here. 
      // For now, we revert to queued to restart pipeline logic safely.
      await this.updateStatus(jobId, 'queued', job.progress);
    }
  }

  async retry(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'failed') {
      await this.updateStatus(jobId, 'retrying', 0, undefined);
      // Wait briefly then queue
      setTimeout(() => this.updateStatus(jobId, 'queued', 0), 100);
    }
  }

  getJob(jobId: string): ProcessingJob | undefined {
    return this.activeJobs.get(jobId);
  }

  getAllJobs(): ProcessingJob[] {
    return Array.from(this.activeJobs.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

export const JobQueue = new JobQueueImpl();
