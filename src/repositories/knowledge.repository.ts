import { supabase } from '../lib/supabase';
import type {
  Flashcard,
  GlossaryTerm,
  MindMapNode,
  TimelineEvent,
  Presentation,
  PresentationSlide,
} from '../types/knowledge';

// ------------------------------------------------------------------
// Flashcards
// ------------------------------------------------------------------
export const KnowledgeRepository = {
  // --- Flashcards ---

  async listFlashcards(documentId: string): Promise<Flashcard[]> {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Flashcard[];
  },

  async addFlashcard(
    card: Omit<Flashcard, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Flashcard> {
    const { data, error } = await supabase
      .from('flashcards')
      .insert(card)
      .select()
      .single();
    if (error) throw error;
    return data as Flashcard;
  },

  async updateFlashcard(
    id: string,
    updates: Partial<Pick<Flashcard, 'front' | 'back' | 'page_number' | 'ease_factor' | 'repetitions' | 'interval_days' | 'next_review_at' | 'last_reviewed_at' | 'last_grade'>>,
  ): Promise<Flashcard> {
    const { data, error } = await supabase
      .from('flashcards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Flashcard;
  },

  async deleteFlashcard(id: string): Promise<void> {
    const { error } = await supabase
      .from('flashcards')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // --- Glossary Terms ---

  async listGlossaryTerms(documentId: string): Promise<GlossaryTerm[]> {
    const { data, error } = await supabase
      .from('glossary_terms')
      .select('*')
      .eq('document_id', documentId)
      .order('term', { ascending: true });
    if (error) throw error;
    return (data ?? []) as GlossaryTerm[];
  },

  async addGlossaryTerm(
    term: Omit<GlossaryTerm, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<GlossaryTerm> {
    const { data, error } = await supabase
      .from('glossary_terms')
      .insert(term)
      .select()
      .single();
    if (error) throw error;
    return data as GlossaryTerm;
  },

  async updateGlossaryTerm(
    id: string,
    updates: Partial<Pick<GlossaryTerm, 'term' | 'definition' | 'page_number'>>,
  ): Promise<GlossaryTerm> {
    const { data, error } = await supabase
      .from('glossary_terms')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as GlossaryTerm;
  },

  async deleteGlossaryTerm(id: string): Promise<void> {
    const { error } = await supabase
      .from('glossary_terms')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // --- Mind Map Nodes ---

  async listMindMapNodes(documentId: string): Promise<MindMapNode[]> {
    const { data, error } = await supabase
      .from('mind_map_nodes')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as MindMapNode[];
  },

  async addMindMapNode(
    node: Omit<MindMapNode, 'id' | 'created_at'>,
  ): Promise<MindMapNode> {
    const { data, error } = await supabase
      .from('mind_map_nodes')
      .insert(node)
      .select()
      .single();
    if (error) throw error;
    return data as MindMapNode;
  },

  async updateMindMapNode(
    id: string,
    updates: Partial<Pick<MindMapNode, 'label' | 'parent_id' | 'position_x' | 'position_y'>>,
  ): Promise<MindMapNode> {
    const { data, error } = await supabase
      .from('mind_map_nodes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as MindMapNode;
  },

  async deleteMindMapNode(id: string): Promise<void> {
    const { error } = await supabase
      .from('mind_map_nodes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // --- Timeline Events ---

  async listTimelineEvents(documentId: string): Promise<TimelineEvent[]> {
    const { data, error } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('document_id', documentId)
      .order('date_str', { ascending: true });
    if (error) throw error;
    return (data ?? []) as TimelineEvent[];
  },

  async addTimelineEvent(
    event: Omit<TimelineEvent, 'id' | 'created_at'>,
  ): Promise<TimelineEvent> {
    const { data, error } = await supabase
      .from('timeline_events')
      .insert(event)
      .select()
      .single();
    if (error) throw error;
    return data as TimelineEvent;
  },

  async deleteTimelineEvent(id: string): Promise<void> {
    const { error } = await supabase
      .from('timeline_events')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Helper to convert DB presentation to app format
  toPresentation: (db: any): Presentation => ({
    ...db,
    slides: db.slides as PresentationSlide[],
  }),

  // --- Presentations ---

  async listPresentations(documentId: string): Promise<Presentation[]> {
    const { data, error } = await supabase
      .from('presentations')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(KnowledgeRepository.toPresentation);
  },

  async addPresentation(
    presentation: Omit<Presentation, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Presentation> {
    const { data, error } = await supabase
      .from('presentations')
      .insert({
        document_id: presentation.document_id,
        workspace_id: presentation.workspace_id,
        title: presentation.title,
        slides: presentation.slides as any, // Cast to Json for DB
      })
      .select()
      .single();
    if (error) throw error;
    return this.toPresentation(data);
  },

  async updatePresentation(
    id: string,
    updates: Partial<Pick<Presentation, 'title' | 'slides'>>,
  ): Promise<Presentation> {
    const { data, error } = await supabase
      .from('presentations')
      .update({
        title: updates.title,
        slides: updates.slides as any,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this.toPresentation(data);
  },

  async deletePresentation(id: string): Promise<void> {
    const { error } = await supabase
      .from('presentations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // --- Batch fetch for a document (used by Viewer on load) ---

  async loadAllForDocument(documentId: string): Promise<{
    flashcards: Flashcard[];
    glossaryTerms: GlossaryTerm[];
    mindMapNodes: MindMapNode[];
    timelineEvents: TimelineEvent[];
    presentations: Presentation[];
  }> {
    const [flashcards, glossaryTerms, mindMapNodes, timelineEvents, presentations] =
      await Promise.all([
        KnowledgeRepository.listFlashcards(documentId),
        KnowledgeRepository.listGlossaryTerms(documentId),
        KnowledgeRepository.listMindMapNodes(documentId),
        KnowledgeRepository.listTimelineEvents(documentId),
        KnowledgeRepository.listPresentations(documentId),
      ]);

    return { flashcards, glossaryTerms, mindMapNodes, timelineEvents, presentations };
  },
};
