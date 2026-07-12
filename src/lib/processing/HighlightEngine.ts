import type { NormalizedRect } from '../../types/highlights';

export class HighlightEngine {
  /**
   * Given a DOM Selection, finds the page element it belongs to
   * and extracts the bounding rects normalized to the page's dimensions (0.0 to 1.0).
   * 
   * @param selection The browser Selection object
   * @returns An object containing the pageIndex, text, and normalized rects, or null if invalid.
   */
  static extractHighlightFromSelection(selection: Selection): {
    pageIndex: number;
    text: string;
    rects: NormalizedRect[];
  } | null {
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    if (!text) return null;

    // Find the closest parent page container
    let container: HTMLElement | null = range.commonAncestorContainer as HTMLElement;
    if (container.nodeType !== Node.ELEMENT_NODE) {
      container = container.parentElement;
    }
    
    const pageContainer = container?.closest('[data-page-index]') as HTMLElement;
    if (!pageContainer) {
      return null; // Selection is outside a PDF page
    }

    const pageIndex = parseInt(pageContainer.getAttribute('data-page-index') || '-1', 10);
    if (pageIndex < 0) return null;

    // Get the bounding box of the page container
    const pageRect = pageContainer.getBoundingClientRect();

    // Get the client rects of the selection
    const domRects = Array.from(range.getClientRects());
    
    const normalizedRects: NormalizedRect[] = domRects.map(rect => {
      return {
        x: (rect.left - pageRect.left) / pageRect.width,
        y: (rect.top - pageRect.top) / pageRect.height,
        width: rect.width / pageRect.width,
        height: rect.height / pageRect.height
      };
    });

    return {
      pageIndex,
      text,
      rects: normalizedRects
    };
  }
}
