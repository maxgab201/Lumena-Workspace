import { useHighlightStore } from '../../../stores/highlightStore';
import { useViewerStore } from '../../../stores/viewerStore';
import { cn } from '../../../lib/utils';
import { useShallow } from 'zustand/react/shallow';
import React from 'react';

interface HighlightOverlayProps {
  pageIndex: number;
}

export const HighlightOverlay = ({ pageIndex }: HighlightOverlayProps) => {
  const { documentId, showOverlays } = useViewerStore(useShallow(state => ({
    documentId: state.documentId,
    showOverlays: state.showOverlays,
  })));
  const {
    getHighlightsForPage,
    activeHighlightId,
    setActiveHighlight,
  } = useHighlightStore(useShallow(state => ({
    getHighlightsForPage: state.getHighlightsForPage,
    activeHighlightId: state.activeHighlightId,
    setActiveHighlight: state.setActiveHighlight,
  })));

  if (!documentId || !showOverlays) return null;

  const highlights = getHighlightsForPage(documentId, pageIndex);
  if (highlights.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 25 }}
      data-layer="highlight"
    >
      {highlights.map((highlight) => {
        const isActive = activeHighlightId === highlight.id;
        const hasNote = Boolean(highlight.note && highlight.note.trim().length > 0);

        return (
          <div
            key={highlight.id}
            className="absolute inset-0 pointer-events-none"
            data-highlight-id={highlight.id}
          >
            {highlight.rects.map((rect, i) => (
              <div
                key={`${highlight.id}-rect-${i}`}
                data-highlight-rect="true"
                className={cn(
                  "absolute opacity-60 cursor-pointer pointer-events-auto transition-all rounded-[2px]",
                  isActive
                    ? "ring-2 ring-primary ring-offset-1 opacity-75 shadow-sm"
                    : "hover:opacity-70"
                )}
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  backgroundColor: highlight.color,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveHighlight(isActive ? null : highlight.id);
                }}
                title={hasNote ? `${highlight.text}\n\n📝 Nota: ${highlight.note}` : highlight.text}
              >
                {/* Note indicator on the first rect */}
                {hasNote && i === 0 && (
                  <span
                    className="absolute -top-3 -right-2 w-4 h-4 bg-amber-400 text-amber-950 rounded-full flex items-center justify-center shadow-md border border-white text-[10px] pointer-events-none select-none font-sans font-bold"
                    title={`Nota: ${highlight.note}`}
                  >
                    ✎
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export const MemoizedHighlightOverlay = React.memo(HighlightOverlay);
