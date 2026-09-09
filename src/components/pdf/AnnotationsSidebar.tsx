import { useState } from 'react';
import { Highlighter, X, Trash2, Edit3, MessageSquarePlus, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { useHighlightStore } from '../../stores/highlightStore';
import { useViewerStore } from '../../stores/viewerStore';
import { cn } from '../../lib/utils';
import type { Highlight } from '../../types/highlights';

const PALETTE = [
  { name: 'Amarillo', color: '#fef08a' },
  { name: 'Verde', color: '#bbf7d0' },
  { name: 'Azul', color: '#bfdbfe' },
  { name: 'Rosa', color: '#fecaca' },
  { name: 'Púrpura', color: '#e9d5ff' },
];

// Stable empty-array reference keeps the store selector referentially stable.
const EMPTY_HIGHLIGHTS: Highlight[] = [];

interface AnnotationsSidebarProps {
  documentId: string;
  workspaceId: string;
  onClose: () => void;
}

export const AnnotationsSidebar = ({ documentId, onClose }: AnnotationsSidebarProps) => {
  const {
    activeHighlightId,
    setActiveHighlight,
    updateHighlight,
    removeHighlight,
  } = useHighlightStore();

  // Subscribe to the COLLECTION so the list updates immediately on
  // create/update/delete — opening/closing the panel must not be required.
  const highlights = useHighlightStore(
    (state) => state.highlights[documentId] ?? EMPTY_HIGHLIGHTS
  );

  const { setCurrentPage } = useViewerStore();

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const handleNavigateToHighlight = (highlight: Highlight) => {
    setCurrentPage(highlight.page_index + 1);
    setActiveHighlight(highlight.id);
  };

  const handleStartEditNote = (highlight: Highlight) => {
    setEditingNoteId(highlight.id);
    setNoteDraft(highlight.note || '');
  };

  const handleSaveNote = (highlightId: string) => {
    updateHighlight(highlightId, { note: noteDraft.trim() || null });
    setEditingNoteId(null);
    setNoteDraft('');
  };

  const handleDeleteNote = (highlightId: string) => {
    updateHighlight(highlightId, { note: null });
    if (editingNoteId === highlightId) {
      setEditingNoteId(null);
      setNoteDraft('');
    }
  };

  return (
    <div
      data-testid="annotations-sidebar"
      className="flex flex-col h-full bg-background/70 backdrop-blur-3xl border-l border-white/10 w-80 shadow-2xl z-30"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Highlighter className="w-4 h-4 text-accent" />
          <h2 className="font-heading font-semibold text-sm tracking-tight">Anotaciones</h2>
          <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-accent/20 text-accent rounded-full tabular-nums">
            {highlights.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-7 h-7 p-0 rounded-lg hover:bg-white/5"
          onClick={onClose}
          aria-label="Cerrar panel de anotaciones"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* List / Empty State */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {highlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center mb-3 text-muted-foreground border border-white/5">
              <Highlighter className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Sin anotaciones todavía</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">
              Selecciona cualquier texto en el documento para subrayarlo o añadir notas.
            </p>
          </div>
        ) : (
          highlights.map((h) => {
            const isActive = activeHighlightId === h.id;
            const isEditingThisNote = editingNoteId === h.id;

            return (
              <div
                key={h.id}
                data-annotation-item="true"
                data-highlight-id={h.id}
                onClick={() => handleNavigateToHighlight(h)}
                className={cn(
                  "p-3 rounded-xl border transition-all cursor-pointer bg-card/40 hover:bg-card/70 flex flex-col gap-2 relative group",
                  isActive
                    ? "border-accent/60 ring-1 ring-accent/40 shadow-md bg-card/80"
                    : "border-white/5 hover:border-white/20"
                )}
              >
                {/* Header row: Page badge + Color dot + Delete */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: h.color }}
                    />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Pág. {h.page_index + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {/* Mini Color Swatches */}
                    <div className="flex items-center gap-1 mr-1" onClick={(e) => e.stopPropagation()}>
                      {PALETTE.map(({ color, name }) => (
                        <button
                          key={color}
                          className={cn(
                            "w-3.5 h-3.5 rounded-full border border-black/20 hover:scale-125 transition-transform",
                            h.color.toLowerCase() === color.toLowerCase() ? "scale-110 ring-1 ring-primary" : ""
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => updateHighlight(h.id, { color })}
                          title={`Cambiar a ${name}`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeHighlight(h.id);
                      }}
                      className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                      title="Eliminar anotación"
                      aria-label="Eliminar anotación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Highlighted text preview */}
                <p className="text-xs text-foreground/90 font-serif italic line-clamp-3 leading-relaxed border-l-2 border-accent/40 pl-2">
                  "{h.text}"
                </p>

                {/* Note display / editor */}
                <div onClick={(e) => e.stopPropagation()}>
                  {isEditingThisNote ? (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Escribe una nota..."
                        rows={2}
                        className="w-full text-xs p-2 rounded-md bg-secondary/60 border border-border focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => setEditingNoteId(null)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-6 text-xs px-2.5"
                          onClick={() => handleSaveNote(h.id)}
                        >
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : h.note ? (
                    <div className="flex items-start justify-between gap-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed text-[11px] flex-1">
                        📝 {h.note}
                      </p>
                      <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        <button
                          onClick={() => handleStartEditNote(h)}
                          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                          title="Editar nota"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(h.id)}
                          className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                          title="Eliminar nota"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEditNote(h)}
                      className="text-[11px] text-muted-foreground hover:text-accent flex items-center gap-1 py-0.5 transition-colors"
                    >
                      <MessageSquarePlus className="w-3 h-3" />
                      Añadir nota
                    </button>
                  )}
                </div>

                {/* Jump to page link */}
                <div className="flex items-center justify-end text-[10px] text-muted-foreground pt-0.5 group-hover:text-accent transition-colors">
                  <span>Ir a página {h.page_index + 1}</span>
                  <ChevronRight className="w-3 h-3 ml-0.5" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
