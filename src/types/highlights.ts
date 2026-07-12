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
  name: string;
  color: string; // e.g. '#ffff00'
}

export interface Highlight {
  id: string;
  documentId: string;
  pageIndex: number;
  
  // A single highlight can span multiple lines, hence multiple rects.
  rects: NormalizedRect[];
  
  // The actual text that was highlighted
  text: string;
  
  // Customization
  color: string;
  categoryId?: string;
  note?: string;
  
  createdAt: number;
  updatedAt: number;
}
