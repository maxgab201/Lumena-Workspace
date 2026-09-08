import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Edit3, MessageSquarePlus, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { useHighlightStore } from '../../stores/highlightStore';
import { cn } from '../../lib/utils';

const HIGHLIGHT_COLORS = [
  { name: 'Amarillo', color: '#fef08a' },
  { name: 'Verde', color: '#bbf7d0' },
  { name: 'Azul', color: '#bfdbfe' },
  { name: 'Rosa', color: '#fecaca' },
  { name: 'Púrpura', color: '#e9d5ff' },
];

export const HighlightDetailPopover = () => {
  const {
    activeHighlightId,
    setActiveHighlight,
    updateHighlight,
    removeHighlight,
    getActiveHighlight,
  } = useHighlightStore();

  const activeHighlight = getActiveHighlight();
  const activeHighlightIdValue = activeHighlight?.id;
  const activeHighlightNote = activeHighlight?.note;
  const popoverRef = useRef<HTMLDivElement>(null);

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [position, setPosition] = useState<{ x: number; y: number; placeAbove: boolean } | null>(null);

  // Sync note text when active highlight changes
  useEffect(() => {
    if (activeHighlightIdValue) {
      setNoteText(activeHighlightNote ?? '');
      setIsEditingNote(false);
    }
  }, [activeHighlightIdValue, activeHighlightNote]);

  // Compute position relative to the active highlight rect on screen
  useEffect(() => {
    if (!activeHighlightId) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const el = document.querySelector(`[data-highlight-id="${activeHighlightId}"] [data-highlight-rect="true"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const placeAbove = rect.top > 180;
        setPosition({
          x: Math.max(160, Math.min(window.innerWidth - 160, rect.left + rect.width / 2)),
          y: placeAbove ? rect.top - 8 : rect.bottom + 8,
          placeAbove,
        });
      } else {
        // Fallback: center in container
        setPosition({
          x: window.innerWidth / 2,
          y: 200,
          placeAbove: false,
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [activeHighlightId]);

  // Close when clicking outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !target.closest('[data-highlight-rect]') &&
        !target.closest('[data-annotation-item]')
      ) {
        setActiveHighlight(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [setActiveHighlight]);

  if (!activeHighlight || !position) return null;

  const handleColorChange = (newColor: string) => {
    updateHighlight(activeHighlight.id, { color: newColor });
  };

  const handleSaveNote = () => {
    updateHighlight(activeHighlight.id, { note: noteText.trim() || null });
    setIsEditingNote(false);
  };

  const handleDeleteNote = () => {
    updateHighlight(activeHighlight.id, { note: null });
    setNoteText('');
    setIsEditingNote(false);
  };

  const handleDeleteHighlight = () => {
    removeHighlight(activeHighlight.id);
    setActiveHighlight(null);
  };

  return (
    <div
      ref={popoverRef}
      data-testid="highlight-detail-popover"
      className="fixed z-50 flex flex-col gap-2.5 p-3 bg-background/95 backdrop-blur-md border border-border/80 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 w-72 text-sm"
      style={{
        top: position.y,
        left: position.x,
        transform: position.placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      }}
    >
      {/* Top Bar: Color Palette + Delete + Close */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/50">
        <div className="flex items-center gap-1.5">
          {HIGHLIGHT_COLORS.map(({ name, color }) => {
            const isSelected = activeHighlight.color.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                className={cn(
                  "w-6 h-6 rounded-full border border-black/20 flex items-center justify-center transition-all hover:scale-110 active:scale-95",
                  isSelected ? "ring-2 ring-primary ring-offset-1 scale-105" : "hover:opacity-90"
                )}
                style={{ backgroundColor: color }}
                onClick={() => handleColorChange(color)}
                title={name}
                aria-label={name}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-neutral-800" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-destructive hover:bg-destructive/10 rounded-lg"
            onClick={handleDeleteHighlight}
            title="Eliminar subrayado"
            aria-label="Eliminar subrayado"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-lg"
            onClick={() => setActiveHighlight(null)}
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Selected Text Excerpt */}
      {activeHighlight.text && (
        <p className="text-xs text-muted-foreground italic line-clamp-2 px-1">
          "{activeHighlight.text}"
        </p>
      )}

      {/* Note Section */}
      <div className="flex flex-col gap-1.5 pt-1">
        {isEditingNote ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Escribe una nota para este subrayado..."
              rows={3}
              className="w-full text-xs p-2 rounded-md bg-secondary/40 border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground"
              autoFocus
            />
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => {
                  setNoteText(activeHighlight.note || '');
                  setIsEditingNote(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs px-3"
                onClick={handleSaveNote}
              >
                Guardar
              </Button>
            </div>
          </div>
        ) : activeHighlight.note ? (
          <div className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/30 border border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                📝 Nota
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsEditingNote(true)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                  title="Editar nota"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  onClick={handleDeleteNote}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                  title="Eliminar nota"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {activeHighlight.note}
            </p>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs flex items-center justify-center gap-1.5 border-dashed hover:border-primary/50"
            onClick={() => setIsEditingNote(true)}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            Añadir nota
          </Button>
        )}
      </div>
    </div>
  );
};
