import { useEffect, useState, useRef } from 'react';
import { X, MessageSquarePlus, Highlighter } from 'lucide-react';
import { Button } from '../ui/Button';
import { useHighlightStore } from '../../stores/highlightStore';
import { useViewerStore } from '../../stores/viewerStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { HighlightEngine } from '../../lib/processing/HighlightEngine';
import { HighlightDetailPopover } from './HighlightDetailPopover';
import type { NormalizedRect } from '../../types/highlights';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

const DEFAULT_COLORS = [
  { name: 'Amarillo', color: '#fef08a' },
  { name: 'Verde', color: '#bbf7d0' },
  { name: 'Azul', color: '#bfdbfe' },
  { name: 'Rosa', color: '#fecaca' },
  { name: 'Púrpura', color: '#e9d5ff' },
];

export const HighlightEditor = ({ workspaceId }: { workspaceId?: string }) => {
  const { documentId } = useViewerStore();
  const { addHighlight } = useHighlightStore();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);

  const [selectionData, setSelectionData] = useState<{
    rects: NormalizedRect[];
    text: string;
    pageIndex: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#fef08a');
  const toolbarRef = useRef<HTMLDivElement>(null);

  const resolvedWorkspaceId = workspaceId || activeWorkspace?.id || '';

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // If clicking inside the toolbar, ignore
      const target = e.target as HTMLElement;
      if (
        toolbarRef.current?.contains(target) ||
        target.closest('[data-highlight-editor]') ||
        target.closest('[data-testid="highlight-editor"]') ||
        target.closest('[data-testid="highlight-detail-popover"]')
      ) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setSelectionData(null);
        setIsAddingNote(false);
        setNoteText('');
        return;
      }

      // Small delay to let browser finish updating selection range
      setTimeout(() => {
        const currentSel = window.getSelection();
        if (!currentSel || currentSel.isCollapsed || currentSel.rangeCount === 0) {
          setSelectionData(null);
          return;
        }

        const extracted = HighlightEngine.extractHighlightFromSelection(currentSel);
        if (extracted && extracted.text.length > 0) {
          const placeAbove = extracted.screenY > 100;
          setSelectionData({
            ...extracted,
            screenX: Math.max(160, Math.min(window.innerWidth - 160, extracted.screenX)),
            screenY: placeAbove ? extracted.screenY - 10 : extracted.screenY + 30,
          });
          setIsAddingNote(false);
          setNoteText('');
        } else {
          setSelectionData(null);
        }
      }, 10);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleCreateHighlight = async (color: string, note?: string) => {
    if (!selectionData || !documentId) return;

    if (!resolvedWorkspaceId) {
      toast.error('No workspace active to save highlight');
      return;
    }

    await addHighlight({
      document_id: documentId,
      workspace_id: resolvedWorkspaceId,
      page_index: selectionData.pageIndex,
      rects: selectionData.rects,
      text: selectionData.text,
      color,
      note: note && note.trim().length > 0 ? note.trim() : undefined,
    });

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setSelectionData(null);
    setIsAddingNote(false);
    setNoteText('');
  };

  return (
    <>
      {/* Floating Selection Toolbar */}
      {selectionData && (
        <div
          ref={toolbarRef}
          data-highlight-editor
          data-testid="highlight-editor"
          className="fixed z-50 flex flex-col gap-2 p-2 bg-background/95 backdrop-blur-md border border-border/80 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: selectionData.screenY,
            left: selectionData.screenX,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {isAddingNote ? (
            /* Inline Note Input */
            <div className="flex flex-col gap-2 w-64 p-1">
              <div className="flex items-center justify-between pb-1 border-b border-border/40">
                <div className="flex items-center gap-1">
                  {DEFAULT_COLORS.map(({ name, color }) => (
                    <button
                      key={color}
                      className={cn(
                        "w-5 h-5 rounded-full border border-black/20 transition-transform hover:scale-110",
                        selectedColor === color ? "ring-2 ring-primary ring-offset-1 scale-105" : "hover:opacity-90"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                      title={name}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6"
                  onClick={() => setIsAddingNote(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>

              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Escribe una nota..."
                rows={2}
                className="w-full text-xs p-2 rounded-md bg-secondary/40 border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                autoFocus
              />

              <div className="flex items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => setIsAddingNote(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-6 text-xs px-2.5"
                  onClick={() => handleCreateHighlight(selectedColor, noteText)}
                >
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            /* Quick Action Toolbar */
            <div className="flex items-center gap-1.5">
              {/* Color Swatches */}
              <div className="flex items-center gap-1 pr-1 border-r border-border/50">
                {DEFAULT_COLORS.map(({ name, color }) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded-full border border-black/20 transition-all hover:scale-110 active:scale-95 hover:shadow-sm"
                    style={{ backgroundColor: color }}
                    onClick={() => handleCreateHighlight(color)}
                    title={`Subrayar en ${name}`}
                    aria-label={`Subrayar en ${name}`}
                  />
                ))}
              </div>

              {/* Subrayar Default Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 gap-1"
                onClick={() => handleCreateHighlight(selectedColor)}
                title="Subrayar texto"
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Subrayar</span>
              </Button>

              {/* Add Note Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 gap-1"
                onClick={() => setIsAddingNote(true)}
                title="Añadir nota al subrayado"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nota</span>
              </Button>

              {/* Cancel Button */}
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6"
                onClick={() => {
                  window.getSelection()?.removeAllRanges();
                  setSelectionData(null);
                }}
                title="Cancelar selección"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Popover for active/clicked highlight */}
      <HighlightDetailPopover />
    </>
  );
};
