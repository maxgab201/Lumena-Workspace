import { useEffect, useMemo, useState } from 'react';
import { MapPinned, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from '../ui/Modal';
import { useViewerStore } from '../../stores/viewerStore';
import { useShallow } from 'zustand/react/shallow';
import {
  buildSequentialOverrides,
  clearLocalPageLabelOverrides,
  loadLocalPageLabelOverrides,
  saveLocalPageLabelOverrides,
} from '../../lib/pageMapping';
import { PageLabelRepository } from '../../repositories/page-label.repository';

interface PageMapEditorProps {
  documentId?: string;
  workspaceId?: string;
}

export const PageMapEditor = ({ documentId, workspaceId }: PageMapEditorProps) => {
  const {
    currentPage,
    totalPages,
    pageLabels,
    pageLabelOverrides,
    applyPageLabelOverrides,
    clearPageLabelOverrides,
  } = useViewerStore(useShallow((state) => ({
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    pageLabels: state.pageLabels,
    pageLabelOverrides: state.pageLabelOverrides,
    applyPageLabelOverrides: state.applyPageLabelOverrides,
    clearPageLabelOverrides: state.clearPageLabelOverrides,
  })));

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [continueSequence, setContinueSequence] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentLabel = useMemo(
    () => pageLabels[currentPage - 1] ?? String(currentPage),
    [pageLabels, currentPage],
  );

  useEffect(() => {
    if (open) {
      setLabel(currentLabel);
      setMessage(null);
    }
  }, [open, currentLabel]);

  const save = async () => {
    if (!label.trim() || currentPage < 1 || totalPages < 1) return;
    setSaving(true);
    setMessage(null);

    const generated = continueSequence
      ? buildSequentialOverrides(currentPage, label.trim(), totalPages)
      : { [currentPage]: label.trim() };

    const merged = { ...pageLabelOverrides, ...generated };
    applyPageLabelOverrides(merged);
    if (documentId) saveLocalPageLabelOverrides(documentId, merged);

    try {
      if (documentId && workspaceId) {
        await PageLabelRepository.upsertOverrides(documentId, workspaceId, generated);
      }
      setMessage(
        continueSequence && Object.keys(generated).length > 1
          ? `Mapeo guardado desde la página PDF ${currentPage} hasta el final.`
          : `Etiqueta guardada para la página PDF ${currentPage}.`,
      );
    } catch (error) {
      console.warn('[PageMapEditor] Remote persistence unavailable; kept local fallback.', error);
      setMessage('Guardado localmente. La sincronización con Supabase quedará activa cuando la migración esté aplicada.');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setMessage(null);
    clearPageLabelOverrides();
    if (documentId) clearLocalPageLabelOverrides(documentId);

    try {
      if (documentId) await PageLabelRepository.clearOverrides(documentId);
      setMessage('Correcciones manuales eliminadas. Se usan las etiquetas nativas del PDF.');
    } catch (error) {
      console.warn('[PageMapEditor] Remote reset unavailable.', error);
      setMessage('Correcciones locales eliminadas. No se pudo sincronizar el reset con Supabase todavía.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Editar numeración lógica de páginas"
          data-testid="page-map-editor-trigger"
        >
          <MapPinned className="h-4 w-4" />
        </Button>
      </ModalTrigger>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Numeración lógica del libro</ModalTitle>
          <ModalDescription>
            Vinculá la página física del PDF con la numeración impresa del libro.
            Sirve para números romanos, prólogos y PDFs cuyo índice no coincide con la página visible.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Página física PDF</span>
              <strong>{currentPage} / {totalPages}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Etiqueta lógica actual</span>
              <strong>{currentLabel}</strong>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Esta página debería llamarse…</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ej. 1, 50, iv, xii"
              maxLength={32}
              className="w-full rounded-lg border border-white/10 bg-background/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
              data-testid="page-map-label-input"
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3">
            <input
              type="checkbox"
              checked={continueSequence}
              onChange={(event) => setContinueSequence(event.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm">
              <strong>Continuar la secuencia desde acá.</strong>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Si escribís 50, la siguiente será 51. Si escribís iv, seguirá v, vi, vii…
              </span>
            </span>
          </label>

          {message && (
            <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-muted-foreground" data-testid="page-map-message">
              {message}
            </p>
          )}

          <div className="flex justify-between gap-3">
            <Button variant="ghost" onClick={reset} disabled={saving || Object.keys(pageLabelOverrides).length === 0}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restablecer
            </Button>
            <Button onClick={save} disabled={saving || !label.trim()} data-testid="page-map-save">
              {saving ? 'Guardando…' : 'Guardar mapeo'}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
};
