import { supabase } from '../lib/supabase';

export class PageLabelRepository {
  static async getOverrides(documentId: string): Promise<Record<number, string>> {
    const { data, error } = await supabase
      .from('document_page_labels')
      .select('page_number,label')
      .eq('document_id', documentId)
      .order('page_number', { ascending: true });

    if (error) throw error;

    return Object.fromEntries(
      (data ?? []).map((row) => [row.page_number, row.label]),
    );
  }

  static async upsertOverrides(
    documentId: string,
    workspaceId: string,
    overrides: Record<number, string>,
  ): Promise<void> {
    const rows = Object.entries(overrides).map(([pageNumber, label]) => ({
      document_id: documentId,
      workspace_id: workspaceId,
      page_number: Number(pageNumber),
      label,
      source: 'manual',
      updated_at: new Date().toISOString(),
    }));

    if (rows.length === 0) return;

    const { error } = await supabase
      .from('document_page_labels')
      .upsert(rows, { onConflict: 'document_id,page_number' });

    if (error) throw error;
  }

  static async clearOverrides(documentId: string): Promise<void> {
    const { error } = await supabase
      .from('document_page_labels')
      .delete()
      .eq('document_id', documentId)
      .eq('source', 'manual');

    if (error) throw error;
  }
}
