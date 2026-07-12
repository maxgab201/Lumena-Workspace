import { useHighlightStore } from '../../../stores/highlightStore';
import { useViewerStore } from '../../../stores/viewerStore';
import { cn } from '../../../lib/utils';

interface HighlightOverlayProps {
  pageIndex: number;
}

export const HighlightOverlay = ({ pageIndex }: HighlightOverlayProps) => {
  const { documentId, showOverlays } = useViewerStore();
  const { 
    getHighlightsForPage, 
    activeHighlightId, 
    setActiveHighlight, 
    removeHighlight 
  } = useHighlightStore();

  if (!documentId || !showOverlays) return null;

  const highlights = getHighlightsForPage(documentId, pageIndex);

  if (highlights.length === 0) return null;

  return (
    <div 
      className="absolute inset-0 pointer-events-none" 
      style={{ zIndex: 30 }}
      data-layer="highlight"
    >
      {highlights.map((highlight) => {
        const isActive = activeHighlightId === highlight.id;
        
        return (
          <div key={highlight.id} className="absolute inset-0">
            {highlight.rects.map((rect, i) => (
              <div
                key={`${highlight.id}-rect-${i}`}
                className={cn(
                  "absolute mix-blend-multiply opacity-50 cursor-pointer pointer-events-auto transition-all",
                  isActive ? "ring-2 ring-primary ring-offset-1 opacity-70" : "hover:opacity-60"
                )}
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  backgroundColor: highlight.color
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveHighlight(isActive ? null : highlight.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Right click removes highlight for now to easily test deletion
                  removeHighlight(highlight.id);
                }}
                title={highlight.note ? `${highlight.text}\n\nNote: ${highlight.note}` : highlight.text}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};
