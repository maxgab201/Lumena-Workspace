import { Page } from 'react-pdf';
import { useViewerStore } from '../../stores/viewerStore';
import { LayoutOverlay } from './overlays/LayoutOverlay';
import { OCROverlay } from './overlays/OCROverlay';
import { VisionOverlay } from './overlays/VisionOverlay';

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
export const PDFPage = ({ pageIndex, width, style }: PDFPageProps) => {
  const { scale, rotation } = useViewerStore();

  const pageNumber = pageIndex + 1;

  return (
    <div
      className="relative flex justify-center"
      style={style}
      data-page-index={pageIndex}
      data-page-number={pageNumber}
    >
      <div className="relative shadow-2xl shadow-black/30 bg-white">
        {/* Layer 1 & 2: PDF Canvas Layer + Text Layer (active via react-pdf) */}
        <Page
          pageNumber={pageNumber}
          width={width * scale}
          rotate={rotation}
          renderTextLayer={true}
          renderAnnotationLayer={false}
          className="pdf-page"
          loading={
            <div
              className="flex items-center justify-center bg-muted/20"
              style={{ width: width * scale, height: width * scale * 1.414 }}
            >
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
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

        {/* Layer 6: Selection Layer (future) */}
        <div
          className="absolute inset-0 pointer-events-none"
          data-layer="selection"
          style={{ zIndex: 40 }}
        />

        {/* Layer 7: AI Overlay Layer */}
        <VisionOverlay pageIndex={pageIndex} />
      </div>
    </div>
  );
};
