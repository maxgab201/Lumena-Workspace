/**
 * BoundingBoxCache - Caches computed bounding boxes
 *
 * Avoids recalculating coordinates on every render.
 */

import { supabase } from '../supabase';

export interface BoundingBox {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class BoundingBoxCache {
  async get(highlightId: string): Promise<BoundingBox | null> {
    const { data } = await (supabase as any)
      .from('highlight_bboxes')
      .select('*')
      .eq('highlight_id', highlightId)
      .single();

    return data;
  }

  async set(highlightId: string, bbox: BoundingBox): Promise<void> {
    await (supabase as any)
      .from('highlight_bboxes')
      .upsert({
        highlight_id: highlightId,
        page_number: bbox.pageNumber,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
  }

  async invalidate(highlightId: string): Promise<void> {
    await (supabase as any)
      .from('highlight_bboxes')
      .delete()
      .eq('highlight_id', highlightId);
  }
}
