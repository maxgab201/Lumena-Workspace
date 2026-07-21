/**
 * AutoHighlightOverlay - Renders AI-generated highlights
 *
 * Shows category-colored overlays with tooltips.
 * Different visual style from manual highlights (subtle glow).
 *
 * NOTE: Currently all highlights are treated as manual since
 * the AI highlight generation is not yet implemented.
 * This overlay will render highlights that have a category set.
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

  const pageHighlights = getHighlightsForPage(documentId, pageIndex);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 35 }}>
      {pageHighlights.map((highlight) => {
        // Use category_id to determine color, fallback to highlight color
        const categoryConfig = getCategoryConfig(highlight.category_id as HighlightCategory || 'concept');
        return highlight.rects.map((rect, i) => (
          <div
            key={`${highlight.id}-${i}`}
            className="absolute"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              backgroundColor: highlight.color || categoryConfig.color,
              opacity: 0.4,
              borderRadius: '2px',
              boxShadow: `0 0 8px ${highlight.color || categoryConfig.color}40`,
            }}
            title={highlight.text}
          />
        ));
      })}
    </div>
  );
}
