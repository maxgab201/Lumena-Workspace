/**
 * Keeps "which page am I on" and "where the scroll position is" from fighting each other.
 *
 * The reader has two ways for the current page to change:
 *  - the user scrolls, and the page that is most visible becomes the current one;
 *  - something navigates (page box, Previous/Next, a search hit, a citation) and the list must scroll there.
 *
 * Treating both the same made them chase each other, in production (a real browser, plain wheel scrolling):
 *  - every time the "most visible page" changed, the effect that reacts to the current page scrolled to that
 *    page's top, so the view jumped forward by up to half a page at every page boundary;
 *  - a page much shorter than its neighbour (a banner, a landscape page) is never the most visible one when
 *    it is aligned to the top, so navigating to it was undone at once: from page 37, Previous never moved,
 *    and Next skipped the short pages.
 *
 * Rule: a page that came from the scroll position never scrolls again, and after navigating, the scroll
 * position may not choose the page until the user scrolls on their own.
 */
export function createPageScrollSync() {
  let navigating = false;
  let gestures = 0;
  const derivedFromScroll = new Set<number>();

  return {
    /**
     * The list measured which page is most visible. Returns the page to make current, or null when the
     * scroll position has no say (it is already current, or a navigation is still settling).
     */
    reportVisiblePage(visiblePage: number, currentPage: number): number | null {
      if (navigating || visiblePage === currentPage) return null;
      derivedFromScroll.add(visiblePage);
      return visiblePage;
    },

    /**
     * The current page changed. True when the list has to scroll there; false when the change came from
     * the scroll position, which is already where that page is.
     */
    shouldScrollTo(page: number): boolean {
      const cameFromScroll = derivedFromScroll.has(page);
      // Whatever else is left over belongs to changes that were superseded: forget it, or a later
      // navigation to one of those pages would be mistaken for a scroll and go nowhere.
      derivedFromScroll.clear();
      if (cameFromScroll) return false;
      navigating = true;
      return true;
    },

    /** The user took the scroll over (wheel, touch, dragging the scrollbar, keys): they choose the page again. */
    userScrolled(): void {
      navigating = false;
      gestures += 1;
    },

    /** How many times the user has taken the scroll over; a watcher compares it to the value it started with. */
    gestures: (): number => gestures,

    /** True from a navigation until the user scrolls on their own. */
    isNavigating: (): boolean => navigating,
  };
}

/** How the list re-aims after a navigation, because it only knows the real height of pages it has drawn. */
export const ALIGN_TOLERANCE_PX = 2;
export const ALIGN_RECHECK_MS = 120;
export const ALIGN_MAX_CORRECTIONS = 8;
/** Consecutive checks that must find the page in place before the list stops watching. */
export const ALIGN_STABLE_CHECKS = 2;

/**
 * Watches a navigation until the page really is where it was asked to be. A jump across pages the list has
 * not measured yet is aimed with estimated heights; measuring them moves the target, and the list's own
 * reconciling did not always catch up (in production, going back from the end of a 120-page document with
 * pages of six different sizes left the view on page 7 or 10 while the counter said 8).
 *
 * `read` gives the offset the page should be at and the offset the list is at. Returns a cancel function.
 */
export function holdNavigation(opts: {
  isNavigating: () => boolean;
  read: () => { wanted: number; current: number };
  reaim: () => void;
  schedule?: (callback: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}): () => void {
  const schedule = opts.schedule ?? ((callback, ms) => setTimeout(callback, ms));
  const cancel = opts.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let corrections = 0;
  let stable = 0;
  let handle: unknown;
  let stopped = false;

  const check = () => {
    if (stopped || !opts.isNavigating()) return;
    const { wanted, current } = opts.read();
    if (Math.abs(wanted - current) > ALIGN_TOLERANCE_PX) {
      stable = 0;
      if (corrections >= ALIGN_MAX_CORRECTIONS) return;
      corrections += 1;
      opts.reaim();
    } else {
      stable += 1;
      if (stable >= ALIGN_STABLE_CHECKS) return;
    }
    handle = schedule(check, ALIGN_RECHECK_MS);
  };

  handle = schedule(check, ALIGN_RECHECK_MS);
  return () => {
    stopped = true;
    cancel(handle);
  };
}

/** Keys that scroll a document. */
export const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']);

/** Where the reader is: the page at the top of the view and how far down that page the top edge is (0 to 1). */
export interface ReadingAnchor {
  /** The layout (page width, zoom, rotation, fit mode) the anchor was measured in. */
  key: string;
  index: number;
  fraction: number;
}

/** The anchor for a scroll offset, from the list's visible items (start/end in the list's own pixels). */
export function anchorAt(items: ReadonlyArray<{ index: number; start: number; end: number }>, scrollOffset: number, key: string): ReadingAnchor | null {
  const top = items.find((item) => item.end > scrollOffset);
  if (!top) return null;
  const size = top.end - top.start;
  const fraction = size > 0 ? Math.min(1, Math.max(0, (scrollOffset - top.start) / size)) : 0;
  return { key, index: top.index, fraction };
}

/**
 * Zooming, rotating, fitting to width or page, or opening a side panel changes every page's height, but the scroll
 * offset stays the same, so the reader ended on a different page (measured in a real browser on a 120-page document:
 * from page 60, one click on zoom in left the view on page 47, five clicks on page 20). After such a change the view
 * goes back to the page and the position inside it that it was at.
 */
export function offsetForAnchor(anchor: Pick<ReadingAnchor, 'fraction'>, pageStart: number, pageSize: number, furthest: number): number {
  return Math.min(pageStart + anchor.fraction * pageSize, Math.max(0, furthest));
}
