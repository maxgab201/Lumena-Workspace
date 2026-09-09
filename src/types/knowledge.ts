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

  // SRS (SM-2 algorithm) fields
  ease_factor?: number;           // EF, default 2.5
  repetitions?: number;           // Number of successful reviews
  interval_days?: number;         // Days until next review
  next_review_at?: string | null; // ISO timestamp of next review
  last_reviewed_at?: string | null;
  last_grade?: number | null;     // 0-5 grade from last review
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

export interface Presentation {
  id: string;
  document_id: string;
  workspace_id: string;
  title: string;
  slides: PresentationSlide[];
  created_at: string;
  updated_at: string;
}

export interface PresentationSlide {
  index: number;
  title: string;
  bullets: string[];
  speaker_note?: string;
}

// --- Extended Knowledge Models ---

export interface Topic {
  id: string;
  document_id: string;
  workspace_id: string;
  title: string;
  summary: string;
  page_range: { start: number; end: number };
  parent_topic_id?: string | null;
  order_index: number;
  created_at: string;
}

export interface Concept {
  id: string;
  document_id: string;
  workspace_id: string;
  name: string;
  definition: string;
  related_topic_ids: string[];
  page_numbers: number[];
  importance: number; // 0-1
  created_at: string;
}

export interface Event {
  id: string;
  document_id: string;
  workspace_id: string;
  title: string;
  date_str: string;
  description: string;
  page_number?: number | null;
  event_type?: 'milestone' | 'deadline' | 'meeting' | 'historical' | 'other';
  created_at: string;
}

// Alias for clarity
export type TimelineItem = TimelineEvent;

export interface FlashcardSRS {
  flashcard: Flashcard;
  // Computed SRS state
  is_due: boolean;
  days_overdue: number;
  mastery_level: 'new' | 'learning' | 'review' | 'mastered';
}

export interface KnowledgeState {
  flashcards: Record<string, Flashcard[]>;      // keyed by document_id
  glossary: Record<string, GlossaryTerm[]>;     // keyed by document_id
  mindMapNodes: Record<string, MindMapNode[]>;  // keyed by document_id
  timelineEvents: Record<string, TimelineEvent[]>; // keyed by document_id
  presentations: Record<string, Presentation[]>; // keyed by document_id
  topics: Record<string, Topic[]>;              // keyed by document_id
  concepts: Record<string, Concept[]>;          // keyed by document_id
  events: Record<string, Event[]>;              // keyed by document_id

  isStudyModeActive: boolean;
  isLoading: boolean;
}