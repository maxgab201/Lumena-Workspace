import { useMemo } from 'react';
import { useHighlightStore } from '../../../stores/highlightStore';
import { useViewerStore } from '../../../stores/viewerStore';
import { HighlightEngine } from '../../../lib/processing/HighlightEngine';
import { cn } from '../../../lib/utils';
import { useShallow } from 'zustand/react/shallow';
import React from 'react';

interface HighlightOverlayProps {
  pageIndex: number;
}

export const HighlightOverlay = ({ pageIndex }: HighlightOverlayProps) => {
  const { documentId, showOverlays, rotation } = useViewerStore(useShallow(state => ({
    documentId: state.documentId,
    showOverlays: state.showOverlays,
    rotation: state.rotation,
  })));
  const { activeHighlightId, setActiveHighlight } = useHighlightStore(useShallow(state => ({
    activeHighlightId: state.activeHighlightId,
    setActiveHighlight: state.setActiveHighlight,
  })));

  // Subscribe to the highlight COLLECTION (not to the selector action) so the
  // overlay re-renders immediately when a highlight is added/updated/removed.
  const docHighlights = useHighlightStore(
    (state) => (documentId ? state.highlights[documentId] : undefined)
  );

  // Reactive derivation from the subscribed collection.
  const highlights = useMemo(
    () => (docHighlights ?? []).filter((h) => h.page_index === pageIndex),
    [docHighlights, pageIndex]
  );

  if (!documentId || !showOverlays) return null;
  if (highlights.length === 0) return null;

  // Canonical (unrotated, normalized) rects are transformed to the CURRENT
  // rotation at render time. Zoom needs no transform here: the overlay is a
  // child of the page wrapper, so percentages scale with it automatically.
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 25 }}
      data-layer="highlight"
    >
      {highlights.map((highlight) => {
        const isActive = activeHighlightId === highlight.id;
        const hasNote = Boolean(highlight.note && highlight.note.trim().length > 0);
        const renderedRects = HighlightEngine.canonicalRectsToRendered(highlight.rects, rotation);

        return (
          <div
            key={highlight.id}
            className="absolute inset-0 pointer-events-none"
            data-highlight-id={highlight.id}
          >
            {renderedRects.map((rect, i) => (
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
