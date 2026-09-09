import type { NormalizedRect } from '../../types/highlights';

/**
 * Canonical highlight geometry.
 *
 * Rects are stored in NORMALIZED coordinates of the UNROTATED page:
 *   - origin (0,0) = top-left corner of the page at rotation 0
 *   - values are normalized 0..1 against the UNROTATED page width/height
 *
 * This representation is independent of zoom, container size, CSS and the
 * current visual rotation. At render time each rect is transformed with the
 * CURRENT rotation (canonicalRectsToRendered) so the highlight stays anchored
 * to the same text at any rotation/zoom/fit mode.
 *
 * Rationale: a highlight means "THIS text on THIS page", not "a rectangle
 * painted at these screen coordinates". Storing semantic text + canonical
 * geometry also lets AI features later ask "what did the user highlight?"
 * without interpreting images.
 */
export class HighlightEngine {
  /**
   * Given a DOM Selection, finds the page element it belongs to and extracts
   * the selected text plus bounding rects converted to canonical page-space
   * (unrotated, normalized 0..1).
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

    // Client-space reference rect of the RENDERED (possibly rotated) page.
    const renderedRect = targetElement.getBoundingClientRect();
    if (renderedRect.width <= 0 || renderedRect.height <= 0) return null;

    // Extract client rects for selection
    const domRects = Array.from(range.getClientRects());
    const validDomRects = domRects.filter((r) => r.width > 0.5 && r.height > 0.5);
    if (validDomRects.length === 0) return null;

    // --- Canonical conversion ---
    // Each DOM client rect lives in screen space of the CURRENT rendered
    // viewport (zoom × rotation applied). Convert it back to the UNROTATED
    // page space:
    //   1. Normalize against the rendered (rotated) box → 0..1 in viewport space
    //   2. Apply the inverse rotation to get 0..1 in unrotated page space
    const rotationDeg = getAppliedRotation(targetElement);

    const normalizedRects: NormalizedRect[] = validDomRects.map((rect) => {
      // 1. Normalize in the rendered (possibly rotated) box
      const vx = (rect.left - renderedRect.left) / renderedRect.width;   // 0..1 across rendered width
      const vy = (rect.top - renderedRect.top) / renderedRect.height;    // 0..1 down rendered height
      const vw = rect.width / renderedRect.width;
      const vh = rect.height / renderedRect.height;

      // 2. Inverse-rotate the normalized viewport coords into unrotated page
      //    space (exact inverses of the forward maps in canonicalRectsToRendered)
      let ux: number, uy: number, uw: number, uh: number;
      switch (rotationDeg % 360) {
        case 90:
          // Forward 90° CW: rendered.x = 1 - (u.y + u.h); rendered.y = u.x
          ux = vy;
          uy = 1 - (vx + vw);
          uw = vh;
          uh = vw;
          break;
        case 180:
          ux = 1 - (vx + vw);
          uy = 1 - (vy + vh);
          uw = vw;
          uh = vh;
          break;
        case 270:
          ux = 1 - (vy + vh);
          uy = vx;
          uw = vh;
          uh = vw;
          break;
        default:
          ux = vx;
          uy = vy;
          uw = vw;
          uh = vh;
      }

      const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
      return {
        x: Number(clamp01(ux).toFixed(5)),
        y: Number(clamp01(uy).toFixed(5)),
        width: Number(clamp01(uw).toFixed(5)),
        height: Number(clamp01(uh).toFixed(5)),
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

  /**
   * Transform canonical (unrotated, normalized) rects into CSS percentage
   * positioning for the CURRENT rendered page box (which reflects the active
   * rotation + zoom). This is the render-time counterpart of the conversion
   * performed in extractHighlightFromSelection.
   */
  static canonicalRectsToRendered(rects: NormalizedRect[], rotationDeg: number): NormalizedRect[] {
    const rotation = ((Math.round(rotationDeg) % 360) + 360) % 360;
    return rects.map((rect) => {
      let vx: number, vy: number, vw: number, vh: number;
      switch (rotation) {
        case 90:
          // Forward 90° CW: rendered.x = 1 - (u.y + u.h); rendered.y = u.x
          vx = 1 - (rect.y + rect.height);
          vy = rect.x;
          vw = rect.height;
          vh = rect.width;
          break;
        case 180:
          vx = 1 - (rect.x + rect.width);
          vy = 1 - (rect.y + rect.height);
          vw = rect.width;
          vh = rect.height;
          break;
        case 270:
          vx = rect.y;
          vy = 1 - (rect.x + rect.width);
          vw = rect.height;
          vh = rect.width;
          break;
        default:
          vx = rect.x;
          vy = rect.y;
          vw = rect.width;
          vh = rect.height;
      }
      return { x: vx, y: vy, width: vw, height: vh };
    });
  }
}

/** Rotation currently applied to the page (0/90/180/270). */
function getAppliedRotation(pageElement: HTMLElement): number {
  // PDF.js stamps the active rotation on its text layer — the same value its
  // own selection geometry uses (see TextLayer#getSelectionBoxes in pdf.mjs).
  const textLayer = pageElement.querySelector('.textLayer');
  const stamped = textLayer?.getAttribute('data-main-rotation');
  if (stamped !== null && stamped !== undefined && stamped !== '') {
    const angle = parseInt(stamped, 10);
    if (!isNaN(angle)) return ((angle % 360) + 360) % 360;
  }
  // Fallback: react-pdf applies rotation via CSS transform on the page container.
  const el = (pageElement.querySelector('.react-pdf__Page') as HTMLElement) || pageElement;
  const transform = getComputedStyle(el).transform;
  if (transform && transform !== 'none') {
    // matrix(a, b, c, d, e, f) — rotation angle = atan2(b, a)
    const match = transform.match(/matrix\(([^)]+)\)/);
    if (match) {
      const [a, b] = match[1].split(',').map(Number);
      const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
      return ((angle % 360) + 360) % 360;
    }
  }
  return 0;
}
