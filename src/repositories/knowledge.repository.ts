import { supabase } from '../lib/supabase';
import { isFeatureEnabled } from '../config/features';
import type {
  Flashcard,
  GlossaryTerm,
  MindMapNode,
  TimelineEvent,
  Presentation,
  PresentationSlide,
} from '../types/knowledge';

/**
 * Presentations is behind a feature flag and its table does not exist in production. Anything that
 * would reach it fails here, before a request is made, instead of as a 404 from the database.
 */
function assertPresentationsEnabled(): void {
  if (!isFeatureEnabled('presentations')) throw new Error('Presentations are not enabled.');
}

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
    assertPresentationsEnabled();
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
    assertPresentationsEnabled();
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
    assertPresentationsEnabled();
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
    assertPresentationsEnabled();
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
    // Presentations is off until its feature flag says otherwise (its table does not exist in
    // production): while it is off nothing is requested for it, so opening a document does not
    // produce a 404 on every load.
    const presentationsEnabled = isFeatureEnabled('presentations');
    const requests: Array<Promise<unknown[]>> = [
      KnowledgeRepository.listFlashcards(documentId),
      KnowledgeRepository.listGlossaryTerms(documentId),
      KnowledgeRepository.listMindMapNodes(documentId),
      KnowledgeRepository.listTimelineEvents(documentId),
    ];
    if (presentationsEnabled) requests.push(KnowledgeRepository.listPresentations(documentId));
    const sections = await Promise.allSettled(requests) as Array<PromiseSettledResult<any[]>>;

    // The sections are independent: one that is unavailable must not hide the others. When EVERY
    // requested section fails (offline, expired session) it is still an error the caller has to see.
    if (sections.every((section) => section.status === 'rejected')) {
      throw (sections[0] as PromiseRejectedResult).reason;
    }
    const sectionOrEmpty = <T>(section: PromiseSettledResult<T[]>, name: string): T[] => {
      if (section.status === 'fulfilled') return section.value;
      console.warn(`[KnowledgeRepository] ${name} unavailable for ${documentId}:`, section.reason);
      return [];
    };

    return {
      flashcards: sectionOrEmpty(sections[0], 'flashcards'),
      glossaryTerms: sectionOrEmpty(sections[1], 'glossary'),
      mindMapNodes: sectionOrEmpty(sections[2], 'mind map'),
      timelineEvents: sectionOrEmpty(sections[3], 'timeline'),
      presentations: presentationsEnabled ? sectionOrEmpty(sections[4], 'presentations') : [],
    };
  },
};
