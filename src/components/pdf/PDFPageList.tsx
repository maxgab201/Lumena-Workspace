import { useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PDFPage } from './PDFPage';
import { useViewerStore } from '../../stores/viewerStore';
import { useShallow } from 'zustand/react/shallow';
import { SCROLL_KEYS, anchorAt, createPageScrollSync, holdNavigation, offsetForAnchor, type ReadingAnchor } from '../../lib/pageScrollSync';
import { overscanForScale } from '../../lib/canvasBudget';

interface PDFPageListProps {
  containerWidth: number;
  containerHeight: number;
}

/** The default page aspect ratio for A4 (height / width) */
const PAGE_ASPECT_RATIO = 1.414;
/** Gap between pages in pixels */
const PAGE_GAP = 16;

/**
 * Virtualized scrollable list of PDF pages.
 * Uses @tanstack/react-virtual for efficient, headless rendering of large documents.
 * Prepared for dynamic heights (e.g. rotation) and overlays.
 */
export const PDFPageList = ({ containerWidth, containerHeight }: PDFPageListProps) => {
  const { totalPages, scale, rotation, currentPage, setCurrentPage, fitMode } = useViewerStore(useShallow(state => ({
    totalPages: state.totalPages,
    scale: state.scale,
    rotation: state.rotation,
    currentPage: state.currentPage,
    setCurrentPage: state.setCurrentPage,
    fitMode: state.fitMode,
  })));
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate page width: leave padding on sides
  const horizontalPadding = 48;
  const availableWidth = containerWidth - horizontalPadding;

  // For fit-width mode, use 100% of available width
  // For fit-page mode, constrain so the full page height fits in the viewport
  let pageWidth = availableWidth;
  if (fitMode === 'fit-page') {
    const maxHeightForPage = containerHeight - PAGE_GAP * 2;
    const isRotated = rotation === 90 || rotation === 270;
    const effectiveAspectRatio = isRotated ? 1 / PAGE_ASPECT_RATIO : PAGE_ASPECT_RATIO;
    const widthFromHeight = maxHeightForPage / effectiveAspectRatio;
    pageWidth = Math.min(availableWidth, widthFromHeight);
  }

  // Calculate row height (page height + gap)
  const getRowHeight = useCallback(
    () => {
      const isRotated = rotation === 90 || rotation === 270;
      const effectiveAspectRatio = isRotated ? 1 / PAGE_ASPECT_RATIO : PAGE_ASPECT_RATIO;
      return Math.ceil(pageWidth * scale * effectiveAspectRatio) + PAGE_GAP;
    },
    [pageWidth, scale, rotation]
  );

  // Who decides the current page: the scroll position (user scrolling) or a navigation. See pageScrollSync.
  const sync = useRef(createPageScrollSync()).current;

  // Every input that changes the height of the pages. When it changes the reader has to be put back where they were.
  const layoutKey = `${Math.round(pageWidth)}|${scale}|${rotation}|${fitMode}`;
  const anchorRef = useRef<ReadingAnchor | null>(null);

  const virtualizer = useVirtualizer({
    count: totalPages,
    getScrollElement: () => parentRef.current,
    estimateSize: getRowHeight,
    // Large pages (high zoom) are millions of pixels each: keep fewer of them mounted around the visible ones.
    overscan: overscanForScale(scale, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1),
    // When scale/rotation/fitMode changes, we force a re-measurement
    onChange: (instance: any) => {
      // Find the most visible page and update the store
      const virtualItems = instance.getVirtualItems();
      if (virtualItems.length > 0) {
        const scrollOffset = instance.scrollOffset ?? 0;
        let mostVisible = virtualItems[0];
        let maxVisibleHeight = 0;

        for (const item of virtualItems) {
          const itemTop = item.start;
          const itemBottom = item.end;
          const visibleTop = Math.max(itemTop, scrollOffset);
          const visibleBottom = Math.min(itemBottom, scrollOffset + containerHeight);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          
          if (visibleHeight > maxVisibleHeight) {
            maxVisibleHeight = visibleHeight;
            mostVisible = item;
          }
        }

        // Remember where the reader is, in the current layout (see the effect below that restores it).
        if (anchorRef.current === null || anchorRef.current.key === layoutKey) {
          anchorRef.current = anchorAt(virtualItems, scrollOffset, layoutKey) ?? anchorRef.current;
        }

        if (maxVisibleHeight > 0) {
          const newPage = sync.reportVisiblePage(mostVisible.index + 1, currentPage);
          // Wrap in timeout or handle safely to avoid React state updates during render
          if (newPage !== null) setTimeout(() => setCurrentPage(newPage), 0);
        }
      }
    }
  });

  // Re-measure when layout inputs change
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, getRowHeight, containerWidth, containerHeight]);

  const containerHeightRef = useRef(containerHeight);
  containerHeightRef.current = containerHeight;

  // After the layout changed (zoom, rotation, fit mode, a side panel opening) go back to the page and the position
  // inside it that the reader was at, and keep it there while the new page heights are measured.
  useEffect(() => {
    const anchor = anchorRef.current;
    if (anchor === null || anchor.key === layoutKey) return;
    const { index, fraction } = anchor;
    const target = () => {
      const start = virtualizer.getOffsetForIndex(index, 'start')?.[0] ?? 0;
      const size = virtualizer.measurementsCache[index]?.size ?? getRowHeight();
      return offsetForAnchor({ fraction }, start, size, virtualizer.getTotalSize() - containerHeightRef.current);
    };
    anchorRef.current = { ...anchor, key: layoutKey };
    virtualizer.scrollToOffset(target());
    const gesturesAtStart = sync.gestures();
    return holdNavigation({
      isNavigating: () => sync.gestures() === gesturesAtStart,
      read: () => ({ wanted: target(), current: virtualizer.scrollOffset ?? 0 }),
      reaim: () => virtualizer.scrollToOffset(target()),
    });
  }, [layoutKey, virtualizer, sync, getRowHeight]);

  // Scroll to the page when it was navigated to. A page that only became current because the user
  // scrolled there must not scroll again (that made the view jump at every page boundary).
  useEffect(() => {
    if (!sync.shouldScrollTo(currentPage)) return;
    const index = currentPage - 1;
    virtualizer.scrollToIndex(index, { align: 'start' });
    // The list only knows the real height of the pages it has drawn, so a long jump is first aimed with
    // estimates. Keep checking that the page really is at the top (the last pages cannot get there: nothing
    // is below them) and re-aim while it is not.
    return holdNavigation({
      isNavigating: sync.isNavigating,
      read: () => {
        const target = virtualizer.getOffsetForIndex(index, 'start')?.[0] ?? 0;
        const furthest = Math.max(0, virtualizer.getTotalSize() - containerHeightRef.current);
        return { wanted: Math.min(target, furthest), current: virtualizer.scrollOffset ?? 0 };
      },
      reaim: () => virtualizer.scrollToIndex(index, { align: 'start' }),
    });
  }, [currentPage, virtualizer, sync]);

  // Scrolling with the keyboard does not reach the list's own handlers (focus is elsewhere).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key) && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        sync.userScrolled();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sync]);

  if (totalPages === 0) return null;

  return (
    <div
      ref={parentRef}
      className="scrollbar-thin relative w-full h-full overflow-auto"
      style={{
        width: containerWidth,
        height: containerHeight,
      }}
      // The user taking the scroll over: wheel, touch, or grabbing the scrollbar (the pointer lands on the
      // list itself, not on a page).
      onWheel={() => sync.userScrolled()}
      onTouchStart={() => sync.userScrolled()}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) sync.userScrolled();
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem: any) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
              paddingTop: PAGE_GAP / 2,
              paddingBottom: PAGE_GAP / 2,
            }}
          >
            <PDFPage
              pageIndex={virtualItem.index}
              width={pageWidth}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
