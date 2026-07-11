export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'member' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  name: string;
  file_url: string;
  status: 'processing' | 'ready' | 'error';
  page_count: number;
  created_at: string;
}

export interface Highlight {
  id: string;
  document_id: string;
  page_number: number;
  content: string;
  note?: string;
  coordinates: any; // Simplified for now
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled';
  current_period_end: string;
}

export interface Credits {
  user_id: string;
  available: number;
  used: number;
  limit: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  created_at: string;
}
