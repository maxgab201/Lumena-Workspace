import type { NormalizedRect } from '../../types/highlights';

export class HighlightEngine {
  /**
   * Given a DOM Selection, finds the page element it belongs to
   * and extracts the bounding rects normalized to the page dimensions (0.0 to 1.0).
   */
  static extractHighlightFromSelection(selection: Selection): {
    pageIndex: number;
    text: string;
    rects: NormalizedRect[];
    screenX: number;
    screenY: number;
  } | null {
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    if (!text) return null;

    // Find the closest parent page element
    let container: HTMLElement | null = range.commonAncestorContainer as HTMLElement;
    if (container.nodeType !== Node.ELEMENT_NODE) {
      container = container.parentElement;
    }

    // Target the exact page wrapper first (matches inner page container), then react-pdf Page or outer page container
    const pageWrapper = (container?.closest('[data-pdf-page-wrapper]') ||
      container?.closest('.react-pdf__Page')) as HTMLElement | null;

    const pageOuter = container?.closest('[data-page-index]') as HTMLElement | null;

    const targetElement = pageWrapper || pageOuter;
    if (!targetElement) return null;

    // Extract pageIndex from data-page-index or 1-based data-page-number
    let pageIndex = -1;
    if (targetElement.hasAttribute('data-page-index')) {
      pageIndex = parseInt(targetElement.getAttribute('data-page-index') || '-1', 10);
    } else if (pageOuter?.hasAttribute('data-page-index')) {
      pageIndex = parseInt(pageOuter.getAttribute('data-page-index') || '-1', 10);
    } else if (targetElement.hasAttribute('data-page-number')) {
      pageIndex = parseInt(targetElement.getAttribute('data-page-number') || '1', 10) - 1;
    }

    if (pageIndex < 0 || isNaN(pageIndex)) return null;

    // Page reference bounding rect: must use the exact page canvas/wrapper dimensions
    const pageRect = targetElement.getBoundingClientRect();
    if (pageRect.width <= 0 || pageRect.height <= 0) return null;

    // Extract client rects for selection
    const domRects = Array.from(range.getClientRects());
    const validDomRects = domRects.filter((r) => r.width > 0.5 && r.height > 0.5);
    if (validDomRects.length === 0) return null;

    const normalizedRects: NormalizedRect[] = validDomRects.map((rect) => {
      const x = Math.max(0, Math.min(1, (rect.left - pageRect.left) / pageRect.width));
      const y = Math.max(0, Math.min(1, (rect.top - pageRect.top) / pageRect.height));
      const width = Math.max(0, Math.min(1 - x, rect.width / pageRect.width));
      const height = Math.max(0, Math.min(1 - y, rect.height / pageRect.height));

      return {
        x: Number(x.toFixed(5)),
        y: Number(y.toFixed(5)),
        width: Number(width.toFixed(5)),
        height: Number(height.toFixed(5)),
      };
    });

    const rangeBounding = range.getBoundingClientRect();

    return {
      pageIndex,
      text,
      rects: normalizedRects,
      screenX: rangeBounding.left + rangeBounding.width / 2,
      screenY: rangeBounding.top,
    };
  }
}
