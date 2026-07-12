import { useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PDFPage } from './PDFPage';
import { useViewerStore } from '../../stores/viewerStore';

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
  const { totalPages, scale, rotation, currentPage, setCurrentPage, fitMode } = useViewerStore();
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

  const virtualizer = useVirtualizer({
    count: totalPages,
    getScrollElement: () => parentRef.current,
    estimateSize: getRowHeight,
    overscan: 2,
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

        const newPage = mostVisible.index + 1;
        if (newPage !== currentPage && maxVisibleHeight > 0) {
          // Wrap in timeout or handle safely to avoid React state updates during render
          setTimeout(() => setCurrentPage(newPage), 0);
        }
      }
    }
  });

  // Re-measure when layout inputs change
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, getRowHeight, containerWidth, containerHeight]);

  // Scroll to page when currentPage changes programmatically
  // We use a local ref to distinguish between programmatic scrolls and user scrolling
  const isProgrammaticScroll = useRef(false);
  
  useEffect(() => {
    if (!isProgrammaticScroll.current) {
      isProgrammaticScroll.current = true;
      virtualizer.scrollToIndex(currentPage - 1, { align: 'start' });
      // Reset flag after small delay to allow scroll to settle
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 100);
    }
  }, [currentPage, virtualizer]);

  if (totalPages === 0) return null;

  return (
    <div
      ref={parentRef}
      className="scrollbar-thin relative w-full h-full overflow-auto"
      style={{
        width: containerWidth,
        height: containerHeight,
      }}
      onScroll={() => {
        isProgrammaticScroll.current = false;
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
