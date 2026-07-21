/**
 * AnalysisCache - Caches analysis results to avoid regeneration
 *
 * Stores results in document_analysis table with versioning.
 * Supports invalidation for regeneration with new models/prompts.
 */

import { supabase } from '../supabase';
import type { Database } from '../../types/supabase';

type AnalysisType = Database['public']['Enums']['analysis_task_type'];

export class AnalysisCache {
  async get(documentId: string, analysisType: string): Promise<unknown | null> {
    const { data } = await supabase
      .from('document_analysis')
      .select('result, version')
      .eq('document_id', documentId)
      .eq('analysis_type', analysisType as AnalysisType)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    return data?.result ?? null;
  }

  async set(documentId: string, analysisType: string, result: unknown): Promise<void> {
    const { error } = await supabase
      .from('document_analysis')
      .upsert({
        document_id: documentId,
        analysis_type: analysisType as AnalysisType,
        result: result as Database['public']['Tables']['document_analysis']['Insert']['result'],
        version: 1,
      }, {
        onConflict: 'document_id,analysis_type,version',
      });

    if (error) throw error;
  }

  async invalidate(documentId: string, analysisType?: string): Promise<void> {
    let query = supabase
      .from('document_analysis')
      .delete()
      .eq('document_id', documentId);

    if (analysisType) {
      query = query.eq('analysis_type', analysisType as AnalysisType);
    }

    await query;
  }
}
