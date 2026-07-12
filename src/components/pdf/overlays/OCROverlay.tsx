import { usePageRegistryStore } from '../../../stores/pageRegistryStore';
import { useViewerStore } from '../../../stores/viewerStore';

interface OCROverlayProps {
  pageIndex: number;
}

export const OCROverlay = ({ pageIndex }: OCROverlayProps) => {
  const page = usePageRegistryStore((state) => state.pages[pageIndex]);
  const showOverlays = useViewerStore((state) => state.showOverlays);

  // We only render this overlay if we want to debug the OCR blocks visually.
  // The actual selectable text is rendered by react-pdf TextLayer.
  if (!showOverlays || !page || page.ocrStatus !== 'completed' || !page.ocrData?.data) {
    return null;
  }

  const { blocks } = page.ocrData.data;

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {blocks.map((block, idx) => {
        const [x0, y0, x1, y1] = block.bbox;
        const left = `${x0 * 100}%`;
        const top = `${y0 * 100}%`;
        const width = `${(x1 - x0) * 100}%`;
        const height = `${(y1 - y0) * 100}%`;

        return (
          <div
            key={idx}
            className="absolute border border-red-500/30 bg-red-500/5 pointer-events-auto group hover:bg-red-500/20 transition-colors"
            style={{ left, top, width, height }}
            title={block.text}
          >
            <span className="absolute -bottom-5 left-0 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              {block.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};
