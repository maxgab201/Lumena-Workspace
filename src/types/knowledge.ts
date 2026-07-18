// Types use snake_case timestamps to match the DB schema directly.
// The stores are responsible for mapping to local JS conventions
// where necessary.

export interface Flashcard {
  id: string;
  document_id: string;
  workspace_id: string;
  front: string;
  back: string;
  page_number?: number | null;
  created_at: string;
  updated_at: string;
}

export interface GlossaryTerm {
  id: string;
  document_id: string;
  workspace_id: string;
  term: string;
  definition: string;
  page_number?: number | null;
  created_at: string;
  updated_at: string;
}

export interface MindMapNode {
  id: string;
  document_id: string;
  workspace_id: string;
  label: string;
  parent_id?: string | null;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  document_id: string;
  workspace_id: string;
  date_str: string;
  description: string;
  page_number?: number | null;
  created_at: string;
}

export interface KnowledgeState {
  flashcards: Record<string, Flashcard[]>;      // keyed by document_id
  glossary: Record<string, GlossaryTerm[]>;     // keyed by document_id
  mindMapNodes: Record<string, MindMapNode[]>;  // keyed by document_id
  timelineEvents: Record<string, TimelineEvent[]>; // keyed by document_id
}
