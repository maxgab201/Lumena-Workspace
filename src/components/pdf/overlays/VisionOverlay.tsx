import { usePageRegistryStore } from '../../../stores/pageRegistryStore';
import { useViewerStore } from '../../../stores/viewerStore';
import { Brain } from 'lucide-react';

interface VisionOverlayProps {
  pageIndex: number;
}

export const VisionOverlay = ({ pageIndex }: VisionOverlayProps) => {
  const page = usePageRegistryStore((state) => state.pages[pageIndex]);
  const showOverlays = useViewerStore((state) => state.showOverlays);

  if (!showOverlays || !page || page.aiStatus !== 'completed' || !page.visionData?.data) {
    return null;
  }

  const { text, objects } = page.visionData.data;

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {/* Render any bounding boxes returned by Vision */}
      {objects && objects.map((obj, idx) => {
        if (!obj.bbox) return null;
        
        const [x0, y0, x1, y1] = obj.bbox;
        const left = `${x0 * 100}%`;
        const top = `${y0 * 100}%`;
        const width = `${(x1 - x0) * 100}%`;
        const height = `${(y1 - y0) * 100}%`;

        return (
          <div
            key={idx}
            className="absolute border-2 border-indigo-500 bg-indigo-500/10 pointer-events-auto group"
            style={{ left, top, width, height }}
            title={`${obj.label} (${Math.round(obj.confidence * 100)}%)`}
          >
            <span className="absolute -top-5 left-0 bg-indigo-600 text-white text-[10px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {obj.label}
            </span>
          </div>
        );
      })}

      {/* Floating AI Summary Card */}
      <div className="absolute top-4 right-4 max-w-xs bg-background/95 backdrop-blur-sm border shadow-lg rounded-md p-3 pointer-events-auto">
        <div className="flex items-center gap-2 mb-2 text-indigo-500">
          <Brain className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Vision AI</span>
        </div>
        <p className="text-sm text-foreground leading-snug">
          {text}
        </p>
      </div>
    </div>
  );
};
