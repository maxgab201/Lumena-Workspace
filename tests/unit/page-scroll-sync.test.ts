import { describe, expect, it, vi } from 'vitest';
import {
  anchorAt,
  offsetForAnchor,
  ALIGN_MAX_CORRECTIONS,
  ALIGN_RECHECK_MS,
  ALIGN_STABLE_CHECKS,
  SCROLL_KEYS,
  createPageScrollSync,
  holdNavigation,
} from '../../src/lib/pageScrollSync';

/**
 * Production evidence (real browser, real QA login, also on the deployed site):
 *  - wheel scrolling jumped by 339 px instead of the 120 px scrolled every time the page counter changed, because the
 *    page that became current by scrolling was scrolled to again;
 *  - in a document with pages of different heights, Previous never left page 37 (page 36 is a banner, never the "most
 *    visible" page once aligned to the top) and Next skipped the banners;
 *  - after jumping to the end and back to page 8 the view sometimes stayed on page 7 or 10 while the counter said 8.
 */
describe('createPageScrollSync', () => {
  it('a page that became current by scrolling does not scroll again (no jump at page boundaries)', () => {
    const sync = createPageScrollSync();
    expect(sync.reportVisiblePage(2, 1)).toBe(2);
    expect(sync.shouldScrollTo(2)).toBe(false);
  });

  it('a navigation scrolls to its page', () => {
    const sync = createPageScrollSync();
    expect(sync.shouldScrollTo(30)).toBe(true);
    expect(sync.isNavigating()).toBe(true);
  });

  it('after a navigation the scroll position cannot move the page away (a short page is not the most visible one)', () => {
    const sync = createPageScrollSync();
    sync.shouldScrollTo(36); // Previous: page 36 is a banner aligned to the top
    expect(sync.reportVisiblePage(37, 36)).toBeNull(); // the next, taller page covers more of the screen
    expect(sync.isNavigating()).toBe(true);
  });

  it('the scroll position decides again as soon as the user scrolls on their own', () => {
    const sync = createPageScrollSync();
    sync.shouldScrollTo(36);
    sync.userScrolled();
    expect(sync.isNavigating()).toBe(false);
    expect(sync.reportVisiblePage(37, 36)).toBe(37);
  });

  it('reports nothing for the page that is already current', () => {
    const sync = createPageScrollSync();
    expect(sync.reportVisiblePage(5, 5)).toBeNull();
  });

  it('forgets scroll-derived pages that were superseded, so a later navigation to one of them still scrolls', () => {
    const sync = createPageScrollSync();
    sync.reportVisiblePage(2, 1);
    sync.reportVisiblePage(3, 2);
    expect(sync.shouldScrollTo(3)).toBe(false); // the render skipped straight to 3
    expect(sync.shouldScrollTo(2)).toBe(true); // 2 was superseded; navigating to it later must scroll
  });

  it('a navigation to the page the user had just scrolled to, after the lock, is still a navigation', () => {
    const sync = createPageScrollSync();
    sync.reportVisiblePage(4, 3);
    sync.shouldScrollTo(4);
    expect(sync.shouldScrollTo(4)).toBe(true);
  });

  it('knows the keys that scroll a document', () => {
    for (const key of ['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' ']) expect(SCROLL_KEYS.has(key)).toBe(true);
    expect(SCROLL_KEYS.has('a')).toBe(false);
  });
});

describe('holdNavigation (re-aim until the page really is at the top)', () => {
  /** A clock the test advances by hand. */
  function harness(initial: { wanted: number; current: number }) {
    const pending: Array<{ at: number; run: () => void; id: number }> = [];
    let now = 0;
    let nextId = 1;
    const state = { ...initial };
    const reaim = vi.fn();
    let navigating = true;
    const stop = holdNavigation({
      isNavigating: () => navigating,
      read: () => ({ ...state }),
      reaim,
      schedule: (run, ms) => {
        const id = nextId++;
        pending.push({ at: now + ms, run, id });
        return id;
      },
      cancel: (handle) => {
        const at = pending.findIndex((entry) => entry.id === handle);
        if (at !== -1) pending.splice(at, 1);
      },
    });
    const advance = (ms: number) => {
      const target = now + ms;
      for (;;) {
        pending.sort((a, b) => a.at - b.at);
        const next = pending[0];
        if (!next || next.at > target) break;
        pending.shift();
        now = next.at;
        next.run();
      }
      now = target;
    };
    return { state, reaim, advance, stop, pendingCount: () => pending.length, setNavigating: (value: boolean) => { navigating = value; } };
  }

  it('re-aims while the view is off the target, then stops once it holds', () => {
    const h = harness({ wanted: 1000, current: 5000 }); // estimated heights put us somewhere else
    h.advance(ALIGN_RECHECK_MS);
    expect(h.reaim).toHaveBeenCalledTimes(1);
    h.state.current = 1000; // the re-aim landed
    h.advance(ALIGN_RECHECK_MS * (ALIGN_STABLE_CHECKS + 1));
    expect(h.reaim).toHaveBeenCalledTimes(1);
    expect(h.pendingCount()).toBe(0); // stopped watching
  });

  it('follows a target that keeps moving while pages are measured', () => {
    const h = harness({ wanted: 1000, current: 1000 });
    h.advance(ALIGN_RECHECK_MS);
    h.state.wanted = 800; // a page above was measured shorter than estimated
    h.advance(ALIGN_RECHECK_MS);
    expect(h.reaim).toHaveBeenCalledTimes(1);
  });

  it('is bounded: it gives up after a fixed number of corrections', () => {
    const h = harness({ wanted: 1000, current: 9999 }); // never lands
    h.advance(ALIGN_RECHECK_MS * (ALIGN_MAX_CORRECTIONS + 5));
    expect(h.reaim).toHaveBeenCalledTimes(ALIGN_MAX_CORRECTIONS);
    expect(h.pendingCount()).toBe(0);
  });

  it('does nothing once the user has taken the scroll over', () => {
    const h = harness({ wanted: 1000, current: 5000 });
    h.setNavigating(false);
    h.advance(ALIGN_RECHECK_MS * 5);
    expect(h.reaim).not.toHaveBeenCalled();
  });

  it('can be cancelled (another navigation, unmount)', () => {
    const h = harness({ wanted: 1000, current: 5000 });
    h.stop();
    h.advance(ALIGN_RECHECK_MS * 5);
    expect(h.reaim).not.toHaveBeenCalled();
  });

  it('tolerates sub-pixel differences', () => {
    const h = harness({ wanted: 1000.4, current: 1000 });
    h.advance(ALIGN_RECHECK_MS * 5);
    expect(h.reaim).not.toHaveBeenCalled();
  });
});

describe('the reader\'s place across a layout change', () => {
  // Pages of 1400 px starting at 0: page index 3 spans 4200..5600
  const items = [{ index: 2, start: 2800, end: 4200 }, { index: 3, start: 4200, end: 5600 }, { index: 4, start: 5600, end: 7000 }];

  it('is the page at the top of the view and how far down it the top edge is', () => {
    expect(anchorAt(items, 4900, 'k')).toEqual({ key: 'k', index: 3, fraction: 0.5 });
    expect(anchorAt(items, 4200, 'k')).toEqual({ key: 'k', index: 3, fraction: 0 });
    expect(anchorAt(items, 3500, 'k')?.index).toBe(2);
  });

  it('keeps the fraction inside 0..1 and survives nothing to anchor to', () => {
    expect(anchorAt(items, 99_999, 'k')).toBeNull();
    expect(anchorAt([{ index: 0, start: 0, end: 0 }], 5, 'k')).toBeNull();
    expect(anchorAt([{ index: 1, start: 100, end: 200 }], 50, 'k')?.fraction).toBe(0);
    expect(anchorAt([{ index: 1, start: 10, end: 10 }], 5, 'k')?.fraction).toBe(0); // a zero-height item cannot divide
  });

  it('goes back to the same place in the page at its new size, never past the end of the document', () => {
    expect(offsetForAnchor({ fraction: 0.5 }, 10_000, 4_000, 99_999)).toBe(12_000);
    expect(offsetForAnchor({ fraction: 0 }, 10_000, 4_000, 99_999)).toBe(10_000);
    expect(offsetForAnchor({ fraction: 0.9 }, 10_000, 4_000, 11_000)).toBe(11_000);
    expect(offsetForAnchor({ fraction: 0.5 }, 0, 4_000, -50)).toBe(0);
  });

  it('counts the times the user takes the scroll over', () => {
    const sync = createPageScrollSync();
    expect(sync.gestures()).toBe(0);
    sync.userScrolled();
    sync.userScrolled();
    expect(sync.gestures()).toBe(2);
  });
});
