import { supabase } from "../lib/supabase";
import type { Highlight, HighlightCategory } from "../types/highlights";

function toHighlight(row: unknown): Highlight {
  return row as Highlight;
}

export const HighlightRepository = {
  async listHighlights(documentId: string): Promise<Highlight[]> {
    const { data, error } = await supabase
      .from("highlights")
      .select("*")
      .eq("document_id", documentId)
      .order("page_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toHighlight);
  },

  async listHighlightsForPage(
    documentId: string,
    pageIndex: number,
  ): Promise<Highlight[]> {
    const { data, error } = await supabase
      .from("highlights")
      .select("*")
      .eq("document_id", documentId)
      .eq("page_index", pageIndex)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toHighlight);
  },

  async createHighlight(
    highlight: Omit<Highlight, "id" | "created_at" | "updated_at">,
  ): Promise<Highlight> {
    const payload: Record<string, unknown> = {
      document_id: highlight.document_id,
      workspace_id: highlight.workspace_id,
      page_index: highlight.page_index,
      rects: highlight.rects as unknown,
      text: highlight.text,
      color: highlight.color || "#fef08a",
      category_id: highlight.category_id && highlight.category_id.trim().length > 0 ? highlight.category_id : null,
      note: highlight.note && highlight.note.trim().length > 0 ? highlight.note.trim() : null,
      source: highlight.source ?? "manual",
      ai_metadata: highlight.ai_metadata ?? null,
    };

    const { data, error } = await supabase
      .from("highlights")
      .insert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return toHighlight(data);
  },

  async updateHighlight(
    id: string,
    updates: Partial<Pick<Highlight, "color" | "note" | "category_id" | "text" | "rects">>,
  ): Promise<Highlight> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ("color" in updates && updates.color !== undefined) {
      payload.color = updates.color;
    }
    if ("category_id" in updates) {
      payload.category_id = updates.category_id && updates.category_id.trim().length > 0 ? updates.category_id : null;
    }
    if ("note" in updates) {
      payload.note = updates.note !== undefined && updates.note !== null && updates.note.trim().length > 0 ? updates.note.trim() : null;
    }
    if ("text" in updates && updates.text !== undefined) {
      payload.text = updates.text;
    }
    if ("rects" in updates && updates.rects) {
      payload.rects = updates.rects as unknown;
    }

    const { data, error } = await supabase
      .from("highlights")
      .update(payload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return toHighlight(data);
  },

  async deleteHighlight(id: string): Promise<void> {
    const { error } = await supabase
      .from("highlights")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async listCategories(workspaceId: string): Promise<HighlightCategory[]> {
    const { data, error } = await supabase
      .from("highlight_categories")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as HighlightCategory[];
  },

  async createCategory(
    workspaceId: string,
    name: string,
    color: string,
  ): Promise<HighlightCategory> {
    const { data, error } = await supabase
      .from("highlight_categories")
      .insert({ workspace_id: workspaceId, name, color })
      .select()
      .single();

    if (error) throw error;
    return data as HighlightCategory;
  },
};
