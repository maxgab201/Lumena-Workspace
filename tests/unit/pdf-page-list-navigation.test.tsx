import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALIGN_MAX_CORRECTIONS, ALIGN_RECHECK_MS } from '../../src/lib/pageScrollSync';

/**
 * The list's wiring of pageScrollSync, with the virtualizer replaced by a fake whose "visible items" the test
 * controls. (The real behaviour was reproduced and verified in a real browser: wheel scrolling no longer jumps at
 * page boundaries, Previous/Next step through every page of a document with pages of different heights, and a long
 * jump lands on its page.)
 */
const virt = vi.hoisted(() => {
  const instance = {
    scrollToIndex: vi.fn(),
    measure: vi.fn(),
    measureElement: vi.fn(),
    getVirtualItems: vi.fn(() => [] as Array<{ index: number; start: number; end: number; key: number }>),
    getTotalSize: vi.fn(() => 200_000),
    getOffsetForIndex: vi.fn((): [number, string] => [0, 'start']),
    scrollToOffset: vi.fn(),
    measurementsCache: [] as Array<{ size: number }>,
    scrollOffset: 0,
  };
  return {
    instance,
    options: null as null | { onChange: (instance: unknown) => void; overscan?: number },
    /** Runs while the list is rendering, like the real virtualizer reporting a position the layout change moved. */
    duringRender: null as null | ((options: { onChange: (instance: unknown) => void }) => void),
  };
});

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { onChange: (instance: unknown) => void; overscan?: number }) => {
    virt.options = options;
    virt.duringRender?.(options);
    return virt.instance;
  },
}));
vi.mock('../../src/components/pdf/PDFPage', () => ({ PDFPage: () => null }));

import { PDFPageList } from '../../src/components/pdf/PDFPageList';
import { useViewerStore } from '../../src/stores/viewerStore';

const CONTAINER_HEIGHT = 900;

/** What the list would report with `top` as the scroll offset and these pages (index, start, end) on screen. */
function reportVisible(items: Array<[number, number, number]>, scrollOffset: number) {
  virt.options!.onChange({
    getVirtualItems: () => items.map(([index, start, end]) => ({ index, start, end, key: index })),
    scrollOffset,
  });
}

/** Page 30 is a banner (268 px) aligned to the top, page 31 a tall page below it: 31 covers more of the screen. */
const bannerThenTall = (): Array<[number, number, number]> => [[29, 1000, 1268], [30, 1284, 2671]];

function mount() {
  const view = render(<PDFPageList containerWidth={1000} containerHeight={CONTAINER_HEIGHT} />);
  const container = view.container.firstElementChild as HTMLElement;
  return { ...view, container };
}

const currentPage = () => useViewerStore.getState().currentPage;
const flushTimeouts = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  virt.duringRender = null;
  virt.instance.scrollOffset = 0;
  virt.instance.measurementsCache = [];
  virt.instance.getTotalSize.mockReturnValue(200_000);
  virt.instance.getOffsetForIndex.mockReturnValue([0, 'start']);
  useViewerStore.setState({ totalPages: 100, currentPage: 1, scale: 1, rotation: 0, fitMode: 'fit-width' } as never);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('<PDFPageList /> page and scroll position', () => {
  it('a page that became current by scrolling is not scrolled to again (the jump at every page boundary)', async () => {
    const { container } = mount();
    await flushTimeouts();
    fireEvent.wheel(container, { deltaY: 100 }); // opening the document counts as a navigation to page 1: the user takes over
    virt.instance.scrollToIndex.mockClear();

    reportVisible([[0, 0, 1400], [1, 1416, 2800]], 1000); // the user scrolled until page 2 covers more
    await flushTimeouts();

    expect(currentPage()).toBe(2);
    expect(virt.instance.scrollToIndex).not.toHaveBeenCalled();
  });

  it('navigating scrolls to the page, once', async () => {
    mount();
    await flushTimeouts();
    virt.instance.scrollToIndex.mockClear();

    await act(async () => { useViewerStore.setState({ currentPage: 30 }); });

    expect(virt.instance.scrollToIndex).toHaveBeenCalledTimes(1);
    expect(virt.instance.scrollToIndex).toHaveBeenCalledWith(29, { align: 'start' });
  });

  it('after navigating to a short page the scroll position cannot move the counter to its neighbour', async () => {
    mount();
    await act(async () => { useViewerStore.setState({ currentPage: 30 }); });
    virt.instance.scrollToIndex.mockClear();

    reportVisible(bannerThenTall(), 1000);
    await flushTimeouts();

    expect(currentPage()).toBe(30);
    expect(virt.instance.scrollToIndex).not.toHaveBeenCalled();
  });

  it('the wheel gives the scroll position the say again', async () => {
    const { container } = mount();
    await act(async () => { useViewerStore.setState({ currentPage: 30 }); });

    fireEvent.wheel(container, { deltaY: 100 });
    reportVisible(bannerThenTall(), 1000);
    await flushTimeouts();

    expect(currentPage()).toBe(31);
  });

  it('touching or grabbing the scrollbar does too, but clicking inside a page does not', async () => {
    const { container } = mount();
    await act(async () => { useViewerStore.setState({ currentPage: 30 }); });

    const insidePage = document.createElement('div');
    container.appendChild(insidePage);
    fireEvent.pointerDown(insidePage); // selecting text on the page is not scrolling
    reportVisible(bannerThenTall(), 1000);
    await flushTimeouts();
    expect(currentPage()).toBe(30);

    fireEvent.pointerDown(container); // the scrollbar belongs to the list itself
    reportVisible(bannerThenTall(), 1000);
    await flushTimeouts();
    expect(currentPage()).toBe(31);
  });

  it('touch scrolling and scroll keys do too, typing in a field does not', async () => {
    const { container } = mount();
    await act(async () => { useViewerStore.setState({ currentPage: 30 }); });

    const field = document.createElement('input');
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    reportVisible(bannerThenTall(), 1000);
    await flushTimeouts();
    expect(currentPage()).toBe(30);
    field.remove();

    fireEvent.keyDown(window, { key: 'PageDown' });
    reportVisible(bannerThenTall(), 1000);
    await flushTimeouts();
    expect(currentPage()).toBe(31);

    await act(async () => { useViewerStore.setState({ currentPage: 10 }); });
    fireEvent.touchStart(container);
    reportVisible([[9, 0, 268], [10, 284, 1700]], 0);
    await flushTimeouts();
    expect(currentPage()).toBe(11);
  });

  it('re-aims while a jump over unmeasured pages has not landed, and stops when it has', async () => {
    mount();
    virt.instance.getOffsetForIndex.mockReturnValue([8_000, 'start']);
    virt.instance.scrollOffset = 3_000; // estimates put the view short of the page
    await act(async () => { useViewerStore.setState({ currentPage: 8 }); });
    virt.instance.scrollToIndex.mockClear();

    await act(async () => { await vi.advanceTimersByTimeAsync(ALIGN_RECHECK_MS); });
    expect(virt.instance.scrollToIndex).toHaveBeenCalledTimes(1);

    virt.instance.scrollOffset = 8_000; // it landed
    await act(async () => { await vi.advanceTimersByTimeAsync(ALIGN_RECHECK_MS * 5); });
    expect(virt.instance.scrollToIndex).toHaveBeenCalledTimes(1);
  });

  it('does not chase the end of the document: the last pages cannot reach the top', async () => {
    mount();
    virt.instance.getTotalSize.mockReturnValue(10_000);
    virt.instance.getOffsetForIndex.mockReturnValue([9_900, 'start']); // page 100 starts 100 px before the end
    virt.instance.scrollOffset = 10_000 - CONTAINER_HEIGHT; // scrolled as far as it goes
    await act(async () => { useViewerStore.setState({ currentPage: 100 }); });
    virt.instance.scrollToIndex.mockClear();

    await act(async () => { await vi.advanceTimersByTimeAsync(ALIGN_RECHECK_MS * 10); });
    expect(virt.instance.scrollToIndex).not.toHaveBeenCalled();
  });

  it('gives up after a bounded number of corrections', async () => {
    mount();
    virt.instance.getOffsetForIndex.mockReturnValue([8_000, 'start']);
    virt.instance.scrollOffset = 0; // never lands
    await act(async () => { useViewerStore.setState({ currentPage: 8 }); });
    virt.instance.scrollToIndex.mockClear();

    await act(async () => { await vi.advanceTimersByTimeAsync(ALIGN_RECHECK_MS * (ALIGN_MAX_CORRECTIONS + 10)); });
    expect(virt.instance.scrollToIndex).toHaveBeenCalledTimes(ALIGN_MAX_CORRECTIONS);
  });

  it('stops re-aiming when the user scrolls, and when another navigation starts', async () => {
    const { container } = mount();
    virt.instance.getOffsetForIndex.mockReturnValue([8_000, 'start']);
    virt.instance.scrollOffset = 0;
    await act(async () => { useViewerStore.setState({ currentPage: 8 }); });
    fireEvent.wheel(container);
    virt.instance.scrollToIndex.mockClear();
    await act(async () => { await vi.advanceTimersByTimeAsync(ALIGN_RECHECK_MS * 5); });
    expect(virt.instance.scrollToIndex).not.toHaveBeenCalled();

    await act(async () => { useViewerStore.setState({ currentPage: 20 }); });
    expect(virt.instance.scrollToIndex).toHaveBeenCalledWith(19, { align: 'start' });
    virt.instance.scrollToIndex.mockClear();
    await act(async () => { useViewerStore.setState({ currentPage: 21 }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(ALIGN_RECHECK_MS); });
    // only the newest navigation is watched
    expect(virt.instance.scrollToIndex.mock.calls.every(([index]) => index === 20)).toBe(true);
  });

  it('keeps fewer pages mounted when they are huge (memory at high zoom), the usual prefetch otherwise', async () => {
    mount();
    expect(virt.options!.overscan).toBe(5);
    await act(async () => { useViewerStore.setState({ scale: 5 } as never); });
    expect(virt.options!.overscan).toBe(1);
    await act(async () => { useViewerStore.setState({ scale: 2 } as never); });
    expect(virt.options!.overscan).toBe(2);
    await act(async () => { useViewerStore.setState({ scale: 1 } as never); });
    expect(virt.options!.overscan).toBe(5);
  });

  describe('keeps the reader where they were when the layout changes (zoom, rotation, fit mode, a side panel)', () => {
    /** The reader is half way down page 60, then the layout changes and page 60 starts at 200 000 and is 2 800 px tall. */
    const readerHalfWayDownPage60 = async (container: HTMLElement) => {
      fireEvent.wheel(container, { deltaY: 100 });
      reportVisible([[58, 82_600, 84_000], [59, 84_000, 85_400]], 84_700);
      await flushTimeouts();
      virt.instance.getTotalSize.mockReturnValue(400_000);
      virt.instance.getOffsetForIndex.mockReturnValue([200_000, 'start']);
      virt.instance.measurementsCache = Object.assign([], { 59: { size: 2_800 } });
      virt.instance.scrollOffset = 84_700; // the offset did not change with the layout: that is the bug
    };

    it('goes back to the same page and the same place in it', async () => {
      const { container } = mount();
      await readerHalfWayDownPage60(container);

      await act(async () => { useViewerStore.setState({ scale: 2 } as never); });

      expect(virt.instance.scrollToOffset).toHaveBeenCalledWith(201_400); // 200 000 + 0.5 × 2 800
    });

    it('does the same when the page width changes (a side panel opening), but not when nothing changed', async () => {
      const view = mount();
      await readerHalfWayDownPage60(view.container);

      view.rerender(<PDFPageList containerWidth={1000} containerHeight={CONTAINER_HEIGHT} />); // same layout
      expect(virt.instance.scrollToOffset).not.toHaveBeenCalled();

      view.rerender(<PDFPageList containerWidth={700} containerHeight={CONTAINER_HEIGHT} />); // the chat panel opened
      expect(virt.instance.scrollToOffset).toHaveBeenCalledWith(201_400);
    });

    it('does not move anything on the first layout', async () => {
      mount();
      await flushTimeouts();
      expect(virt.instance.scrollToOffset).not.toHaveBeenCalled();
    });

    it('uses the place the reader had in the layout they just left, not an older one', async () => {
      const { container } = mount();
      await readerHalfWayDownPage60(container);
      await act(async () => { useViewerStore.setState({ scale: 2 } as never); });

      // in the new layout the reader scrolls to page 70, a quarter of the way down
      reportVisible([[69, 300_000, 302_800]], 300_700);
      await flushTimeouts();
      virt.instance.scrollToOffset.mockClear();
      virt.instance.getOffsetForIndex.mockReturnValue([90_000, 'start']);
      virt.instance.measurementsCache = Object.assign([], { 69: { size: 1_400 } });
      await act(async () => { useViewerStore.setState({ scale: 1 } as never); });

      expect(virt.instance.scrollToOffset).toHaveBeenCalledWith(90_350); // 90 000 + 0.25 × 1 400
    });

    it('is not fooled by the position the list reports while the layout is changing', async () => {
      const { container } = mount();
      await readerHalfWayDownPage60(container);
      // the new heights have not been applied yet, so the unchanged offset now falls on page 20
      virt.duringRender = (options) => options.onChange({ getVirtualItems: () => [{ index: 19, start: 28_000, end: 29_400, key: 19 }], scrollOffset: 28_500 });

      await act(async () => { useViewerStore.setState({ scale: 2 } as never); });

      expect(virt.instance.scrollToOffset).toHaveBeenCalledWith(201_400); // page 60, not page 20
    });

    it('keeps re-aiming while the new page heights are measured, and stops when the user scrolls', async () => {
      const { container } = mount();
      await readerHalfWayDownPage60(container);
      await act(async () => { useViewerStore.setState({ scale: 2 } as never); });
      virt.instance.scrollToOffset.mockClear();

      await act(async () => { await vi.advanceTimersByTimeAsync(ALIGN_RECHECK_MS); });
      expect(virt.instance.scrollToOffset).toHaveBeenCalledWith(201_400); // still short of where it should be

      fireEvent.wheel(container);
      virt.instance.scrollToOffset.mockClear();
      await act(async () => { await vi.advanceTimersByTimeAsync(ALIGN_RECHECK_MS * 5); });
      expect(virt.instance.scrollToOffset).not.toHaveBeenCalled();
    });
  });
});
