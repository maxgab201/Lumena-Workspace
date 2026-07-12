import { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useHighlightStore } from '../../stores/highlightStore';
import { useViewerStore } from '../../stores/viewerStore';
import { HighlightEngine } from '../../lib/processing/HighlightEngine';

export const HighlightEditor = () => {
  const { documentId } = useViewerStore();
  const { addHighlight, categories } = useHighlightStore();
  
  const [selectionData, setSelectionData] = useState<{
    rects: any[];
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
    addHighlight({
      id: crypto.randomUUID(),
      documentId,
      pageIndex: selectionData.pageIndex,
      rects: selectionData.rects,
      text: selectionData.text,
      color,
      categoryId,
      createdAt: Date.now(),
      updatedAt: Date.now()
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
        left: Math.max(10, selectionData.screenX),
        top: Math.max(10, selectionData.screenY),
        transform: 'translate(-50%, -100%)' // Center horizontally, above selection
      }}
    >
      <div className="flex items-center gap-1 border-r border-border pr-1 mr-1">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => handleCreateHighlight(cat.color, cat.id)}
            className="w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ backgroundColor: cat.color }}
            title={`Highlight as ${cat.name}`}
          />
        ))}
      </div>
      
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectionData(null)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
