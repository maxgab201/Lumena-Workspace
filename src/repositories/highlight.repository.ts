import { supabase } from '../lib/supabase';
import type { Highlight, HighlightCategory } from '../types/highlights';

/**
 * The Supabase-generated types describe `rects` as `Json` because it's stored
 * as JSONB. We know the actual runtime shape is `NormalizedRect[]`, so we cast
 * through `unknown` here at the repository boundary. All incoming data from the
 * DB will have been validated by Postgres constraints and our own serialization
 * (which always writes NormalizedRect[]).
 */
function toHighlight(row: unknown): Highlight {
  return row as Highlight;
}

export const HighlightRepository = {
  async listHighlights(documentId: string): Promise<Highlight[]> {
    const { data, error } = await supabase
      .from('highlights')
      .select('*')
      .eq('document_id', documentId)
      .order('page_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toHighlight);
  },

  async listHighlightsForPage(
    documentId: string,
    pageIndex: number,
  ): Promise<Highlight[]> {
    const { data, error } = await supabase
      .from('highlights')
      .select('*')
      .eq('document_id', documentId)
      .eq('page_index', pageIndex)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toHighlight);
  },

  async createHighlight(
    highlight: Omit<Highlight, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Highlight> {
    // Cast rects through unknown since Supabase uses Json type for JSONB
    const payload = { ...highlight, rects: highlight.rects as unknown };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase
      .from('highlights')
      .insert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return toHighlight(data);
  },

  async updateHighlight(
    id: string,
    updates: Partial<Pick<Highlight, 'color' | 'note' | 'category_id' | 'text' | 'rects'>>,
  ): Promise<Highlight> {
    // Cast rects through unknown since Supabase uses Json type for JSONB
    const payload = updates.rects
      ? { ...updates, rects: updates.rects as unknown }
      : { ...updates };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase
      .from('highlights')
      .update(payload as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return toHighlight(data);
  },

  async deleteHighlight(id: string): Promise<void> {
    const { error } = await supabase
      .from('highlights')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async listCategories(workspaceId: string): Promise<HighlightCategory[]> {
    const { data, error } = await supabase
      .from('highlight_categories')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as HighlightCategory[];
  },

  async createCategory(
    workspaceId: string,
    name: string,
    color: string,
  ): Promise<HighlightCategory> {
    const { data, error } = await supabase
      .from('highlight_categories')
      .insert({ workspace_id: workspaceId, name, color })
      .select()
      .single();

    if (error) throw error;
    return data as HighlightCategory;
  },
};
