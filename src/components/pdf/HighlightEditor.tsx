import { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useHighlightStore } from '../../stores/highlightStore';
import { useViewerStore } from '../../stores/viewerStore';
import { HighlightEngine } from '../../lib/processing/HighlightEngine';
import type { NormalizedRect } from '../../types/highlights';

interface HighlightEditorProps {
  workspaceId?: string;
}

export const HighlightEditor = ({ workspaceId = '' }: HighlightEditorProps) => {
  const { documentId } = useViewerStore();
  const { addHighlight, categories } = useHighlightStore();
  
  const [selectionData, setSelectionData] = useState<{
    rects: NormalizedRect[];
    text: string;
    pageIndex: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  const pendingSelection = useRef<Selection | null>(null);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        // If clicking inside the editor, don't close it
        const target = e.target as HTMLElement;
        if (target.closest('[data-highlight-editor]')) {
          return;
        }
        setSelectionData(null);
        return;
      }

      const extracted = HighlightEngine.extractHighlightFromSelection(selection);
      if (extracted) {
        pendingSelection.current = selection;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setSelectionData({
          ...extracted,
          screenX: rect.left + rect.width / 2,
          screenY: rect.top - 10
        });
      } else {
        setSelectionData(null);
      }
    };

    // Need to use document for global mouse up
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  if (!selectionData || !documentId) return null;

  const handleCreateHighlight = (color: string, categoryId: string) => {
    if (!workspaceId) {
      console.error('[HighlightEditor] workspaceId is required but not provided');
      return;
    }
    addHighlight({
      document_id: documentId,
      workspace_id: workspaceId,
      page_index: selectionData.pageIndex,
      rects: selectionData.rects,
      text: selectionData.text,
      color,
      category_id: categoryId,
    });

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setSelectionData(null);
  };

  return (
    <div
      data-highlight-editor
      className="fixed z-50 flex items-center gap-1 p-1.5 bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-200"
      style={{
        top: selectionData.screenY,
        left: selectionData.screenX,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {/* Default colors if no categories loaded */}
      {categories.length > 0 ? (
        categories.map((cat) => (
          <button
            key={cat.id}
            className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white/40 transition-all hover:scale-110 active:scale-95"
            style={{ backgroundColor: cat.color }}
            onClick={() => handleCreateHighlight(cat.color, cat.id)}
            title={cat.name}
          />
        ))
      ) : (
        ['#fef08a', '#bfdbfe', '#fecaca'].map((color) => (
          <button
            key={color}
            className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white/40 transition-all hover:scale-110 active:scale-95"
            style={{ backgroundColor: color }}
            onClick={() => handleCreateHighlight(color, '')}
          />
        ))
      )}
      <Button
        variant="ghost"
        size="icon"
        className="w-6 h-6"
        onClick={() => setSelectionData(null)}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
};
