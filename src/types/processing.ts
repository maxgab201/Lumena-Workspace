// ─── Processing Infrastructure Types ───────────────────────────────

export type JobStatus = 
  | 'queued' 
  | 'inspecting' 
  | 'extracting' 
  | 'ocr' 
  | 'layout' 
  | 'completed' 
  | 'failed' 
  | 'retrying' 
  | 'cancelled' 
  | 'paused';

export interface ProcessingJob {
  id: string;
  workspace_id: string;
  document_id: string;
  status: JobStatus;
  progress: number;
  error_details?: string | null;
  provider_metadata?: any | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessingEvent {
  id: string;
  job_id: string;
  event_type: string;
  event_data: any;
  created_at: string;
}

export interface ProcessingLog {
  id: string;
  job_id: string;
  log_level: 'info' | 'warn' | 'error';
  message: string;
  created_at: string;
}
