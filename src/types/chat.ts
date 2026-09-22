export type Role = 'user' | 'assistant' | 'system';

export interface ChatReference {
  id: string;
  type: 'highlight' | 'page' | 'document';
  text?: string;
  pageIndex?: number;
}

export interface Citation {
  document_id: string;
  document_name: string;
  page_number: number;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
  match_type: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: Role;
  content: string;
  references?: ChatReference[];
  citations?: Citation[];
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

export interface ChatHighlightContext {
  text: string;
  page: number;
  color: string;
  category?: string;
  note?: string;
  source?: 'manual' | 'ai';
}

export interface ChatContext {
  documentId?: string;
  workspaceId?: string;
  currentPage: number;
  currentPageLabel?: string;
  requestedPages?: Array<{ physicalPage: number; logicalLabel: string; text: string }>;
  activeHighlights: ChatHighlightContext[];
  recentMessages: Array<{
    role: string;
    content: string;
  }>;
  documentName?: string;
  workspaceName?: string;
  selectedText?: string;
  selectedTextPageIndex?: number;
  documentText?: string;
  allHighlights?: ChatHighlightContext[];
  selectionRects?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  language?: string;
  selectedModel?: string;
  ragChunks?: Array<{
    document_id: string;
    document_name: string;
    page_number: number;
    chunk_index: number;
    chunk_text: string;
    similarity: number;
    match_type: string;
  }>;
}
