/**
 * TaskQueue - Interface for managing analysis tasks
 *
 * Currently implemented with Supabase.
 * Ready to migrate to a distributed queue system.
 */

import { supabase } from '../supabase';

export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';

export interface ProcessingTask {
  id: string;
  documentId: string;
  task: string;
  status: TaskStatus;
  dependsOn: string[];
  provider?: string;
  model?: string;
  version: number;
  providerVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface TaskQueue {
  enqueue(task: Omit<ProcessingTask, 'id' | 'status'>): Promise<ProcessingTask>;
  dequeue(): Promise<ProcessingTask | null>;
  retry(taskId: string): Promise<void>;
  cancel(taskId: string): Promise<void>;
  getTaskStatus(taskId: string): Promise<ProcessingTask | null>;
  getTasksByDocument(documentId: string): Promise<ProcessingTask[]>;
}

export class SupabaseTaskQueue implements TaskQueue {
  async enqueue(task: Omit<ProcessingTask, 'id' | 'status'>): Promise<ProcessingTask> {
    const { data, error } = await (supabase as any)
      .from('processing_tasks')
      .insert({
        document_id: task.documentId,
        task: task.task,
        status: 'pending',
        depends_on: task.dependsOn,
        provider: task.provider,
        model: task.model,
        version: task.version || 1,
        provider_version: task.providerVersion,
        prompt_version: task.promptVersion,
        schema_version: task.schemaVersion,
      })
      .select()
      .single();

    if (error) throw error;
    return data as ProcessingTask;
  }

  async dequeue(): Promise<ProcessingTask | null> {
    // Get next pending task with all dependencies satisfied
    const { data, error } = await (supabase as any)
      .from('processing_tasks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) return null;

    // Check if dependencies are met
    const deps = data.depends_on || [];
    if (deps.length > 0) {
      const { count } = await (supabase as any)
        .from('processing_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', data.document_id)
        .in('task', deps)
        .eq('status', 'completed');

      if (count !== deps.length) return null;
    }

    // Mark as queued
    await (supabase as any)
      .from('processing_tasks')
      .update({ status: 'queued' })
      .eq('id', data.id);

    return data as ProcessingTask;
  }

  async retry(taskId: string): Promise<void> {
    await (supabase as any)
      .from('processing_tasks')
      .update({ status: 'pending', error: null })
      .eq('id', taskId);
  }

  async cancel(taskId: string): Promise<void> {
    await (supabase as any)
      .from('processing_tasks')
      .update({ status: 'failed', error: 'Cancelled by user' })
      .eq('id', taskId);
  }

  async getTaskStatus(taskId: string): Promise<ProcessingTask | null> {
    const { data } = await (supabase as any)
      .from('processing_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    return data as ProcessingTask | null;
  }

  async getTasksByDocument(documentId: string): Promise<ProcessingTask[]> {
    const { data } = await (supabase as any)
      .from('processing_tasks')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    return (data || []) as ProcessingTask[];
  }
}
