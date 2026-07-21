/**
 * TaskQueue - Interface for managing analysis tasks
 *
 * Currently implemented with Supabase.
 * Ready to migrate to a distributed queue system.
 */

import { supabase } from '../supabase';
import type { Database } from '../../types/supabase';

export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';

export type AnalysisTaskType = Database['public']['Enums']['analysis_task_type'];

export interface ProcessingTask {
  id: string;
  documentId: string;
  task: AnalysisTaskType;
  status: TaskStatus;
  dependsOn: AnalysisTaskType[];
  provider?: string;
  model?: string;
  version?: number;
  providerVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskQueue {
  enqueue(task: Omit<ProcessingTask, 'id' | 'status'>): Promise<ProcessingTask>;
  dequeue(): Promise<ProcessingTask | null>;
  retry(taskId: string): Promise<void>;
  cancel(taskId: string): Promise<void>;
  getTaskStatus(taskId: string): Promise<ProcessingTask | null>;
  getTasksByDocument(documentId: string): Promise<ProcessingTask[]>;
}

type ProcessingTasksRow = Database['public']['Tables']['processing_tasks']['Row'];
type ProcessingTasksInsert = Database['public']['Tables']['processing_tasks']['Insert'];

function rowToTask(row: ProcessingTasksRow): ProcessingTask {
  return {
    id: row.id,
    documentId: row.document_id ?? '',
    task: row.task,
    status: row.status as TaskStatus,
    dependsOn: (row.depends_on as AnalysisTaskType[]) || [],
    provider: row.provider ?? '',
    model: row.model ?? '',
    version: row.version ?? 1,
    providerVersion: row.provider_version ?? '',
    promptVersion: row.prompt_version ?? '',
    schemaVersion: row.schema_version ?? '',
    startedAt: row.started_at ?? '',
    finishedAt: row.finished_at ?? '',
    error: row.error ?? '',
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export class SupabaseTaskQueue implements TaskQueue {
  async enqueue(task: Omit<ProcessingTask, 'id' | 'status'>): Promise<ProcessingTask> {
    const insertData: ProcessingTasksInsert = {
      document_id: task.documentId,
      task: task.task,
      status: 'pending',
      depends_on: task.dependsOn,
      provider: task.provider,
      model: task.model,
      version: task.version,
      provider_version: task.providerVersion,
      prompt_version: task.promptVersion,
      schema_version: task.schemaVersion,
    };

    const { data, error } = await supabase
      .from('processing_tasks')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return rowToTask(data);
  }

  async dequeue(): Promise<ProcessingTask | null> {
    const { data, error } = await supabase
      .from('processing_tasks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) return null;

    const deps = (data.depends_on as AnalysisTaskType[] | null) || [];
    if (deps.length > 0 && data.document_id) {
      const { count } = await supabase
        .from('processing_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', data.document_id)
        .in('task', deps as any)
        .eq('status', 'completed');

      if (count !== deps.length) return null;
    }

    await supabase
      .from('processing_tasks')
      .update({ status: 'queued' })
      .eq('id', data.id);

    return rowToTask(data);
  }

  async retry(taskId: string): Promise<void> {
    await supabase
      .from('processing_tasks')
      .update({ status: 'pending', error: null })
      .eq('id', taskId);
  }

  async cancel(taskId: string): Promise<void> {
    await supabase
      .from('processing_tasks')
      .update({ status: 'failed', error: 'Cancelled by user' })
      .eq('id', taskId);
  }

  async getTaskStatus(taskId: string): Promise<ProcessingTask | null> {
    const { data } = await supabase
      .from('processing_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    return data ? rowToTask(data) : null;
  }

  async getTasksByDocument(documentId: string): Promise<ProcessingTask[]> {
    const { data } = await supabase
      .from('processing_tasks')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    return (data || []).map(rowToTask);
  }
}
