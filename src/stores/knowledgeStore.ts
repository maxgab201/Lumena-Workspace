import { create } from 'zustand';
import { KnowledgeRepository } from '../repositories/knowledge.repository';
import { supabase } from '../lib/supabase';
import type {
  Flashcard,
  GlossaryTerm,
  MindMapNode,
  TimelineEvent,
} from '../types/knowledge';

interface KnowledgeStoreState {
  flashcards: Record<string, Flashcard[]>;
  glossary: Record<string, GlossaryTerm[]>;
  mindMapNodes: Record<string, MindMapNode[]>;
  timelineEvents: Record<string, TimelineEvent[]>;
  isStudyModeActive: boolean;
  isLoading: boolean;

  loadKnowledge: (documentId: string) => Promise<void>;

  addFlashcard: (
    documentId: string,
    workspaceId: string,
    card: Pick<Flashcard, 'front' | 'back' | 'page_number'>,
  ) => Promise<void>;
  deleteFlashcard: (id: string, documentId: string) => Promise<void>;

  addGlossaryTerm: (
    documentId: string,
    workspaceId: string,
    term: Pick<GlossaryTerm, 'term' | 'definition' | 'page_number'>,
  ) => Promise<void>;
  deleteGlossaryTerm: (id: string, documentId: string) => Promise<void>;

  addMindMapNode: (
    documentId: string,
    workspaceId: string,
    node: Pick<MindMapNode, 'label' | 'parent_id' | 'position_x' | 'position_y'>,
  ) => Promise<void>;
  deleteMindMapNode: (id: string, documentId: string) => Promise<void>;

  addTimelineEvent: (
    documentId: string,
    workspaceId: string,
    event: Pick<TimelineEvent, 'date_str' | 'description' | 'page_number'>,
  ) => Promise<void>;
  deleteTimelineEvent: (id: string, documentId: string) => Promise<void>;

  setStudyMode: (active: boolean) => void;

  isGenerating: boolean;
  generationError: string | null;
  generateFlashcards: (documentId: string, workspaceId: string) => Promise<void>;
  generateGlossary: (documentId: string, workspaceId: string) => Promise<void>;
  generateMindMap: (documentId: string, workspaceId: string) => Promise<void>;
}

async function callAiGateway(
  supabase: any,
  reservationId: string,
  workspaceId: string,
  prompt: string,
  documentId: string,
): Promise<{ text: string }> {
  const aiGatewayResponse = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/ai-gateway`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sb-access-token') || ''}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({
        prompt,
        workspace_id: workspaceId,
        action_type: 'knowledge_generation',
        model_code: '',
        document_id: documentId,
      }),
    });

  if (!aiGatewayResponse.ok) {
    await supabase.rpc('release_credits_simple', { p_reservation_id: reservationId });
    const errorData = await aiGatewayResponse.json();
    throw new Error(errorData.error || 'AI generation failed');
  }

  const aiResult = await aiGatewayResponse.json();
  return { text: aiResult.text?.trim() || '' };
}

function parseAiResponse(responseText: string): any[] {
  const cleaned = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
  return parsed;
}

async function generateKnowledge(
  supabase: any,
  workspaceId: string,
  documentId: string,
  actionType: 'flashcards' | 'glossary' | 'mindmap',
  promptBuilder: (title: string, extract: string) => string,
  insertFn: (parsed: any[], documentId: string, workspaceId: string) => Promise<any[]>,
  cost: number,
): Promise<any[]> {
  const reservationId = await reserveCredits(supabase, workspaceId, documentId, actionType);
  
  try {
    const { data: doc } = await supabase
      .from('documents')
      .select('name, extracted_text')
      .eq('id', documentId)
      .single();

    if (!doc || !doc.extracted_text) {
      throw new Error('Document not found or has no extracted text');
    }

    const excerpt = doc.extracted_text.substring(0, 8000);
    const prompt = promptBuilder(doc.name, excerpt);

    const aiResult = await callAiGateway(supabase, reservationId, workspaceId, prompt, documentId);
    const responseText = aiResult.text?.trim() || '';

    let parsed: any[];
    try {
      parsed = parseAiResponse(aiResult.text);
    } catch {
      await supabase.rpc('release_credits_simple', { p_reservation_id: reservationId });
      throw new Error('AI returned malformed JSON. Please try again.');
    }

    const inserted = await insertFn(parsed, documentId, workspaceId);

    await supabase.rpc('settle_credits_simple', {
      p_reservation_id: reservationId,
      p_actual_amount: cost,
    });

    return inserted;
  } catch (err: any) {
    await supabase.rpc('release_credits_simple', { p_reservation_id: reservationId });
    throw err;
  }
}

async function reserveCredits(
  supabase: any,
  workspaceId: string,
  documentId: string,
  actionType: string,
): Promise<string> {
  const { data: reservation, error } = await supabase.rpc('reserve_credits_simple', {
    p_workspace_id: workspaceId,
    p_amount: 10,
    p_idempotency_key: `knowledge:${documentId}:${actionType}`,
    p_job_id: null,
    p_ttl_seconds: 300,
  });
  if (error) throw new Error('Failed to reserve credits: ' + error.message);
  return reservation;
}

async function insertFlashcards(parsed: any[], documentId: string, workspaceId: string): Promise<any[]> {
  const rows = parsed
    .map((item: any) => ({
      document_id: documentId,
      workspace_id: workspaceId,
      front: String(item.front ?? '').trim(),
      back: String(item.back ?? '').trim(),
    }))
    .filter((r) => r.front && r.back);

  const { data, error } = await supabase.from('flashcards').insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

async function insertGlossary(parsed: any[], documentId: string, workspaceId: string): Promise<any[]> {
  const rows = parsed
    .map((item: any) => ({
      document_id: documentId,
      workspace_id: workspaceId,
      term: String(item.term ?? '').trim(),
      definition: String(item.definition ?? '').trim(),
    }))
    .filter(r => r.term && r.definition);

  const { data, error } = await supabase.from('glossary_terms').insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

async function insertMindmap(parsed: any[], documentId: string, workspaceId: string, supabase: any): Promise<any[]> {
  const root = parsed.find((n: any) => !n.parent_label);
  const children = parsed.filter((n: any) => !!n.parent_label);

  if (!root) {
    throw new Error('Mind map must have a root node with parent_label: null');
  }

  const { data: rootData, error: rootErr } = await supabase
    .from('mind_map_nodes')
    .insert({ document_id: documentId, workspace_id: workspaceId, label: String(root.label).trim(), parent_id: null, position_x: 0, position_y: 0 })
    .select()
    .single();

  if (rootErr || !rootData) throw rootErr ?? new Error('Failed to insert root node');

  const inserted = [rootData];

  const childRows = children.map((child: any, i: number) => {
      return {
        document_id: documentId,
        workspace_id: workspaceId,
        label: String(child.label).trim(),
        parent_id: rootData.id,
        position_x: (i % 4) * 220 - 330,
        position_y: Math.floor(i / 4) * 150 + 150,
      };
    });

  if (childRows.length > 0) {
    const { data: childData, error: childErr } = await supabase
      .from('mind_map_nodes')
      .insert(childRows)
      .select();
    if (childErr) throw childErr;
    inserted.push(...(childData ?? []));
  }

  return inserted;
}

export const useKnowledgeStore = create<KnowledgeStoreState>((set, get) => ({
  flashcards: {},
  glossary: {},
  mindMapNodes: {},
  timelineEvents: {},
  isStudyModeActive: false,
  isLoading: false,
  isGenerating: false,
  generationError: null,

  loadKnowledge: async (documentId) => {
    set({ isLoading: true });
    try {
      const { flashcards, glossaryTerms, mindMapNodes, timelineEvents } =
        await KnowledgeRepository.loadAllForDocument(documentId);

      set((state) => ({
        flashcards: { ...state.flashcards, [documentId]: flashcards },
        glossary: { ...state.glossary, [documentId]: glossaryTerms },
        mindMapNodes: { ...state.mindMapNodes, [documentId]: mindMapNodes },
        timelineEvents: { ...state.timelineEvents, [documentId]: timelineEvents },
        isLoading: false,
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to load knowledge:', err);
      set({ isLoading: false });
    }
  },

  addFlashcard: async (documentId, workspaceId, cardData) => {
    try {
      const created = await KnowledgeRepository.addFlashcard({
        document_id: documentId,
        workspace_id: workspaceId,
        ...cardData,
      });
      set((state) => ({
        flashcards: {
          ...state.flashcards,
          [documentId]: [...(state.flashcards[documentId] ?? []), created],
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to add flashcard:', err);
    }
  },

  deleteFlashcard: async (id, documentId) => {
    try {
      await KnowledgeRepository.deleteFlashcard(id);
      set((state) => ({
        flashcards: {
          ...state.flashcards,
          [documentId]: (state.flashcards[documentId] ?? []).filter((c) => c.id !== id),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to delete flashcard:', err);
    }
  },

  addGlossaryTerm: async (documentId, workspaceId, termData) => {
    try {
      const created = await KnowledgeRepository.addGlossaryTerm({
        document_id: documentId,
        workspace_id: workspaceId,
        ...termData,
      });
      set((state) => ({
        glossary: {
          ...state.glossary,
          [documentId]: [...(state.glossary[documentId] ?? []), created],
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to add glossary term:', err);
    }
  },

  deleteGlossaryTerm: async (id, documentId) => {
    try {
      await KnowledgeRepository.deleteGlossaryTerm(id);
      set((state) => ({
        glossary: {
          ...state.glossary,
          [documentId]: (state.glossary[documentId] ?? []).filter((t) => t.id !== id),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to delete glossary term:', err);
    }
  },

  addMindMapNode: async (documentId, workspaceId, nodeData) => {
    try {
      const created = await KnowledgeRepository.addMindMapNode({
        document_id: documentId,
        workspace_id: workspaceId,
        ...nodeData,
      });
      set((state) => ({
        mindMapNodes: {
          ...state.mindMapNodes,
          [documentId]: [...(state.mindMapNodes[documentId] ?? []), created],
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to add mind map node:', err);
    }
  },

  deleteMindMapNode: async (id, documentId) => {
    try {
      await KnowledgeRepository.deleteMindMapNode(id);
      set((state) => ({
        mindMapNodes: {
          ...state.mindMapNodes,
          [documentId]: (state.mindMapNodes[documentId] ?? []).filter((n) => n.id !== id),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to delete mind map node:', err);
    }
  },

  addTimelineEvent: async (documentId, workspaceId, eventData) => {
    try {
      const created = await KnowledgeRepository.addTimelineEvent({
        document_id: documentId,
        workspace_id: workspaceId,
        ...eventData,
      });
      set((state) => ({
        timelineEvents: {
          ...state.timelineEvents,
          [documentId]: [...(state.timelineEvents[documentId] ?? []), created],
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to add timeline event:', err);
    }
  },

  deleteTimelineEvent: async (id, documentId) => {
    try {
      await KnowledgeRepository.deleteTimelineEvent(id);
      set((state) => ({
        timelineEvents: {
          ...state.timelineEvents,
          [documentId]: (state.timelineEvents[documentId] ?? []).filter((e) => e.id !== id),
        },
      }));
    } catch (err) {
      console.error('[KnowledgeStore] Failed to delete timeline event:', err);
    }
  },

  setStudyMode: (active) => set({ isStudyModeActive: active }),

  isGenerating: false,
  generationError: null,

  generateFlashcards: async (documentId: string, workspaceId: string) => {
    set({ isGenerating: true, generationError: null });
    try {
      const inserted = await generateKnowledge(
        supabase,
        workspaceId,
        documentId,
        'flashcards',
        (title, extract) => `You are an expert educator. Based on the following document excerpt from "${title}", generate 8-10 high-quality flashcards for studying.

DOCUMENT EXCERPT:
${extract}

Respond ONLY with a valid JSON array of objects. Each object must have exactly:
{ "front": "question or concept", "back": "answer or explanation" }

Do not include any explanatory text, markdown, or code fences. Only the raw JSON array.`,
        insertFlashcards,
        10,
      );

      set((state) => ({
        flashcards: {
          ...state.flashcards,
          [documentId]: [...(state.flashcards[documentId] ?? []), ...inserted],
        },
        isGenerating: false,
      }));
    } catch (err: any) {
      set({ isGenerating: false, generationError: err.message });
      throw err;
    }
  },

  generateGlossary: async (documentId: string, workspaceId: string) => {
    set({ isGenerating: true, generationError: null });
    try {
      const inserted = await generateKnowledge(
        supabase,
        workspaceId,
        documentId,
        'glossary',
        (title, extract) => `You are an expert in knowledge extraction. Based on the following document excerpt from "${title}", identify and define the 8-12 most important technical terms, concepts, or specialized vocabulary.

DOCUMENT EXCERPT:
${extract}

Respond ONLY with a valid JSON array of objects. Each object must have exactly:
{ "term": "term name", "definition": "clear and concise definition" }

Do not include any explanatory text, markdown, or code fences. Only the raw JSON array.`,
        insertGlossary,
        10,
      );

      set((state) => ({
        glossary: {
          ...state.glossary,
          [documentId]: [...(state.glossary[documentId] ?? []), ...inserted],
        },
        isGenerating: false,
      }));
    } catch (err: any) {
      set({ isGenerating: false, generationError: err.message });
      throw err;
    }
  },

  generateMindMap: async (documentId: string, workspaceId: string) => {
    set({ isGenerating: true, generationError: null });
    try {
      const inserted = await generateKnowledge(
        supabase,
        workspaceId,
        documentId,
        'mindmap',
        (title, extract) => `You are an expert at structuring information. Based on the following document excerpt from "${title}", create a hierarchical mind map.

DOCUMENT EXCERPT:
${extract}

Respond ONLY with a valid JSON array of nodes. The first node should be the root (central topic).
Each object must have exactly: { "label": "node label", "parent_label": null or "parent node label" }
The root node must have parent_label: null. All other nodes reference a parent by its label.
Limit to 12-15 nodes total.

Do not include any explanatory text, markdown, or code fences. Only the raw JSON array.`,
        async (parsed, docId, wsId) => {
          const { supabase: supabaseClient } = await import('../lib/supabase');
          return insertMindmap(parsed, docId, wsId, supabaseClient);
        },
        10,
      );

      set((state) => ({
        mindMapNodes: {
          ...state.mindMapNodes,
          [documentId]: [...(state.mindMapNodes[documentId] ?? []), ...inserted],
        },
        isGenerating: false,
      }));
    } catch (err: any) {
      set({ isGenerating: false, generationError: err.message });
      throw err;
    }
  },
}));