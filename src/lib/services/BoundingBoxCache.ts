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
    const { data } = await supabase
      .from('highlight_bboxes')
      .select('*')
      .eq('highlight_id', highlightId)
      .single();

    if (!data) return null;

    return {
      pageNumber: data.page_number,
      x: data.x ?? 0,
      y: data.y ?? 0,
      width: data.width ?? 0,
      height: data.height ?? 0,
    };
  }

  async set(highlightId: string, bbox: BoundingBox): Promise<void> {
    await supabase
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
    await supabase
      .from('highlight_bboxes')
      .delete()
      .eq('highlight_id', highlightId);
  }
}
