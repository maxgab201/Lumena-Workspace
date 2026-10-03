import React, { useState } from 'react';
import { Page } from 'react-pdf';
import { useViewerStore } from '../../stores/viewerStore';
import { usePageRegistryStore } from '../../stores/pageRegistryStore';
import { effectiveRotation, normalizeRotation } from '../../lib/pageRotation';
import { maxCanvasPixelsFor, pagePixelRatio } from '../../lib/canvasBudget';
import { useShallow } from 'zustand/react/shallow';
import { LayoutOverlay } from './overlays/LayoutOverlay';
import { OCROverlay } from './overlays/OCROverlay';
import { VisionOverlay } from './overlays/VisionOverlay';
import { HighlightOverlay } from './overlays/HighlightOverlay';

interface PDFPageProps {
  pageIndex: number;
  width: number;
  style?: React.CSSProperties;
}

/**
 * Renders a single PDF page with layered architecture.
 * The Canvas + Text layers are active. Highlight, OCR, Annotation,
 * and AI overlay layers are rendered as empty containers for future use.
 */
export const PDFPage = React.memo(({ pageIndex, width, style }: PDFPageProps) => {
  const { scale, rotation, pageLabels } = useViewerStore(useShallow(state => ({
    scale: state.scale,
    rotation: state.rotation,
    pageLabels: state.pageLabels,
  })));

  const intrinsicRotation = usePageRegistryStore((state) => state.pages[pageIndex]?.intrinsicRotation);

  const pageNumber = pageIndex + 1;
  const targetWidth = Math.max(100, Math.floor(width * scale));
  const pageLabel = pageLabels[pageIndex] ?? String(pageNumber);

  // The page's own (unrotated) size, known once it has loaded. Until then the canvas budget assumes A4.
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const displayRotation = intrinsicRotation === undefined ? 0 : effectiveRotation(intrinsicRotation, rotation);
  const aspect = pageSize
    ? (displayRotation % 180 === 0 ? pageSize.height / pageSize.width : pageSize.width / pageSize.height)
    : 1.414;
  // At high zoom a page is tens of millions of pixels: draw it at a lower resolution rather than exhaust memory
  // (or, on iOS, get a blank canvas). Normal zoom is untouched: the ratio only drops when the cap is reached.
  const devicePixelRatio = pagePixelRatio(
    targetWidth,
    targetWidth * aspect,
    typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
    typeof navigator === 'undefined'
      ? undefined
      : maxCanvasPixelsFor(navigator.userAgent, navigator.maxTouchPoints ?? 0, window.devicePixelRatio || 1),
  );

  return (
    <div
      className="relative flex justify-center py-2"
      style={style}
      data-page-outer-index={pageIndex}
      data-page-number={pageNumber}
      data-page-label={pageLabel}
    >
      <div
        className="relative shadow-2xl shadow-black/40 bg-white rounded-sm"
        data-pdf-page-wrapper="true"
        data-page-index={pageIndex}
        data-page-number={pageNumber}
      >
        {/* Layer 1 & 2: PDF Canvas Layer + Text Layer (active via react-pdf) */}
        <Page
          pageNumber={pageNumber}
          width={targetWidth}
          devicePixelRatio={devicePixelRatio}
          // Until the page reports its own /Rotate, let react-pdf use it (the same value for an unrotated view).
          rotate={intrinsicRotation === undefined ? undefined : effectiveRotation(intrinsicRotation, rotation)}
          onLoadSuccess={(page) => {
            setPageSize((current) => (current && current.width === page.originalWidth && current.height === page.originalHeight ? current : { width: page.originalWidth, height: page.originalHeight }));
            const own = normalizeRotation(page.rotate);
            if (own !== intrinsicRotation) usePageRegistryStore.getState().updatePage(pageIndex, { intrinsicRotation: own });
          }}
          renderTextLayer={true}
          renderAnnotationLayer={false}
          className="pdf-page bg-white"
          loading={
            <div
              className="flex items-center justify-center bg-white"
              style={{ width: targetWidth, height: Math.floor(targetWidth * 1.414) }}
            >
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          }
          error={
            <div
              className="flex items-center justify-center bg-white text-rose-500 text-xs p-4"
              style={{ width: targetWidth, height: Math.floor(targetWidth * 1.414) }}
            >
              Failed to render page {pageNumber}
            </div>
          }
        />

        {/* Layer 3: Annotation Layer (future) */}
        <div
          className="absolute inset-0 pointer-events-none"
          data-layer="annotation"
          style={{ zIndex: 10 }}
        />

        {/* Layer 4: Layout Overlay */}
        <LayoutOverlay pageIndex={pageIndex} />

        {/* Layer 5: OCR Overlay */}
        <OCROverlay pageIndex={pageIndex} />

        {/* Layer 6: Highlight Layer */}
        <HighlightOverlay pageIndex={pageIndex} />

        {/* Layer 7: AI Overlay Layer */}
        <VisionOverlay pageIndex={pageIndex} />
      </div>
    </div>
  );
}, (prev, next) => {
  // NOTE: scale/rotation are consumed from the store inside the component, so
  // they re-render pages even when width/style props are unchanged.
  return prev.pageIndex === next.pageIndex &&
         prev.width === next.width &&
         prev.style === next.style;
});
