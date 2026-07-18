export type Role = 'user' | 'assistant' | 'system';

export interface ChatReference {
  id: string;
  type: 'highlight' | 'page' | 'document';
  text?: string;
  pageIndex?: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: Role;
  content: string;
  references?: ChatReference[];
  created_at: string;
}

export interface ChatSession {
  id: string;
  document_id: string;
  workspace_id: string;
  user_id: string;
  title?: string | null;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}
