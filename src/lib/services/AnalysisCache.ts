/**
 * AnalysisCache - Caches analysis results to avoid regeneration
 *
 * Stores results in document_analysis table with versioning.
 * Supports invalidation for regeneration with new models/prompts.
 */

import { supabase } from '../supabase';

export class AnalysisCache {
  async get(documentId: string, analysisType: string): Promise<any | null> {
    const { data } = await (supabase as any)
      .from('document_analysis')
      .select('result, version')
      .eq('document_id', documentId)
      .eq('analysis_type', analysisType)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    return data?.result || null;
  }

  async set(documentId: string, analysisType: string, result: any): Promise<void> {
    const { error } = await (supabase as any)
      .from('document_analysis')
      .upsert({
        document_id: documentId,
        analysis_type: analysisType,
        result,
        version: 1,
      }, {
        onConflict: 'document_id,analysis_type,version',
      });

    if (error) throw error;
  }

  async invalidate(documentId: string, analysisType?: string): Promise<void> {
    let query = (supabase as any)
      .from('document_analysis')
      .delete()
      .eq('document_id', documentId);

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    await query;
  }
}
