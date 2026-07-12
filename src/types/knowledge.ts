export interface Flashcard {
  id: string;
  documentId: string;
  front: string;
  back: string;
  pageNumber?: number;
  createdAt: number;
}

export interface GlossaryTerm {
  id: string;
  documentId: string;
  term: string;
  definition: string;
  pageNumber?: number;
  createdAt: number;
}

export interface MindMapNode {
  id: string;
  documentId: string;
  label: string;
  parentId?: string; // If undefined, it's a root node
}

export interface TimelineEvent {
  id: string;
  documentId: string;
  dateStr: string;
  description: string;
  pageNumber?: number;
}

export interface KnowledgeState {
  flashcards: Record<string, Flashcard[]>; // keyed by documentId
  glossary: Record<string, GlossaryTerm[]>; // keyed by documentId
  mindMapNodes: Record<string, MindMapNode[]>; // keyed by documentId
  timelineEvents: Record<string, TimelineEvent[]>; // keyed by documentId
}
