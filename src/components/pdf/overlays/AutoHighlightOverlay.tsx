/**
 * AutoHighlightOverlay - Renders AI-generated highlights
 *
 * Shows category-colored overlays with tooltips.
 * Different visual style from manual highlights (subtle glow).
 */

import { useHighlightStore } from '../../../stores/highlightStore';
import { useViewerStore } from '../../../stores/viewerStore';
import { getCategoryConfig } from '../../../config/highlightCategories';
import type { HighlightCategory } from '../../../config/highlightCategories';

interface AutoHighlightOverlayProps {
  pageIndex: number;
}

export function AutoHighlightOverlay({ pageIndex }: AutoHighlightOverlayProps) {
  const { getHighlightsForPage } = useHighlightStore();
  const { showOverlays, documentId } = useViewerStore();

  if (!showOverlays || !documentId) return null;

  const pageHighlights = getHighlightsForPage(documentId, pageIndex).filter(
    (h: any) => h.source === 'ai'
  );

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 35 }}>
      {pageHighlights.map((highlight: any) => {
        const config = getCategoryConfig(highlight.category as HighlightCategory);
        return highlight.rects.map((rect: any, i: number) => (
          <div
            key={`${highlight.id}-${i}`}
            className="absolute"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              backgroundColor: config.color,
              opacity: 0.4,
              borderRadius: '2px',
              boxShadow: `0 0 8px ${config.color}40`,
            }}
            title={`${config.label}: ${highlight.text}`}
          />
        ));
      })}
    </div>
  );
}
