export type Role = 'user' | 'assistant' | 'system';

export interface ChatReference {
  id: string;
  type: 'highlight' | 'page' | 'document';
  text?: string;
  pageIndex?: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  references?: ChatReference[];
  createdAt: number;
}

export interface ChatSession {
  id: string;
  documentId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
