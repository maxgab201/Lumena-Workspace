/**
 * Represents a bounding box in normalized coordinates (0.0 to 1.0)
 * relative to the page dimensions.
 */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HighlightCategory {
  id: string;
  workspace_id: string;
  name: string;
  color: string; // hex e.g. '#ffff00'
  created_at: string;
}

export interface Highlight {
  id: string;
  document_id: string;
  workspace_id: string;
  page_index: number;

  // A single highlight can span multiple lines, hence multiple rects.
  rects: NormalizedRect[];

  // The actual text that was highlighted
  text: string;

  // Customization
  color: string;
  category_id?: string | null;
  note?: string | null;

  created_at: string;
  updated_at: string;
}
