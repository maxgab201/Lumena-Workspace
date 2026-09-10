import { useState } from 'react';
import { Sparkles, Loader2, X, FileText, ScanText, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { AiHighlightService, type AiDensity, type AiScope, type AiHighlightProgress } from '../../lib/ai/AiHighlightService';
import { cn } from '../../lib/utils';

interface AiHighlightPanelProps {
  documentId: string;
  workspaceId: string;
  fileUrl: string;
  currentPage: number; // 1-based
  onClose: () => void;
}

/**
 * AI Highlighting panel (Checkpoint 3).
 * ✨ Subrayar con IA — the AI picks SEMANTIC segments; Lumena resolves the
 * real geometry from the text/OCR inventory. Billing is not wired yet.
 */
export const AiHighlightPanel = ({ documentId, workspaceId, fileUrl, currentPage, onClose }: AiHighlightPanelProps) => {
  const [scope, setScope] = useState<AiScope>('document');
  const [density, setDensity] = useState<AiDensity>('normal');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<AiHighlightProgress | null>(null);
  const [result, setResult] = useState<{ created: number; failedPages: Array<{ page: number; error: string }>; ocrPages: number; nativePages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      // Fetch the PDF bytes through the signed URL the viewer already has
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error('No se pudo descargar el PDF para analizarlo.');
      const blob = await res.blob();

      const summary = await AiHighlightService.highlightDocument({
        file: blob,
        documentId,
        workspaceId,
        scope,
        pageNumber: scope === 'page' ? currentPage : undefined,
        density,
        onProgress: setProgress,
      });

      setResult(summary);
    } catch (err) {
      console.error('[AiHighlightPanel] run failed:', err);
      setError(err instanceof Error ? err.message : 'Error inesperado durante el análisis.');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const phaseLabel: Record<string, string> = {
    inventory: 'Analizando documento…',
    ocr: 'Procesando OCR',
    analyzing: 'La IA está eligiendo el texto importante…',
    matching: 'Ubicando subrayados…',
    done: 'Listo',
  };

  return (
    <div
      data-testid="ai-highlight-panel"
      className="flex flex-col h-full bg-background/70 backdrop-blur-3xl border-l border-white/10 w-80 shadow-2xl z-30"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <h2 className="font-heading font-semibold text-sm tracking-tight">Subrayar con IA</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-7 h-7 p-0 rounded-lg hover:bg-white/5"
          onClick={onClose}
          aria-label="Cerrar panel de IA"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {!running && !result && (
          <>
            {/* Scope */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alcance</p>
              <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                <button
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    scope === 'document' ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setScope('document')}
                  data-testid="ai-scope-document"
                >
                  <FileText className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                  Documento
                </button>
                <button
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    scope === 'page' ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setScope('page')}
                  data-testid="ai-scope-page"
                >
                  Página actual
                </button>
              </div>
            </div>

            {/* Density */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Densidad</p>
              <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                {([
                  { id: 'low', label: 'Poco' },
                  { id: 'normal', label: 'Normal' },
                  { id: 'high', label: 'Mucho' },
                ] as Array<{ id: AiDensity; label: string }>).map((d) => (
                  <button
                    key={d.id}
                    className={cn(
                      'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      density === d.id ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setDensity(d.id)}
                    data-testid={`ai-density-${d.id}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                La IA analiza el texto real del documento y elige qué fragmentos son importantes. Los subrayados aparecen sobre el PDF y podés editarlos, anotarlos o borrarlos como cualquier otro.
              </p>
            </div>

            <Button
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleRun}
              data-testid="ai-highlight-run-btn"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Subrayar con IA
            </Button>
          </>
        )}

        {/* Progress */}
        {running && progress && (
          <div className="space-y-3 py-4" data-testid="ai-highlight-progress">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
              <div>
                <p className="text-sm font-medium">{phaseLabel[progress.phase] ?? 'Trabajando…'}</p>
                {progress.phase === 'ocr' && progress.pagesTotal != null && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <ScanText className="w-3 h-3" />
                    Página {progress.ocrPageNumber ?? '?'} · {progress.pagesDone} / {progress.pagesTotal}
                  </p>
                )}
                {progress.phase === 'analyzing' && progress.pagesTotal != null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {progress.detail} · página {progress.pagesDone} de {progress.pagesTotal}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !running && (
          <div className="space-y-4" data-testid="ai-highlight-result">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-sm text-foreground">
                {result.created > 0
                  ? `${result.created} subrayado${result.created === 1 ? '' : 's'} con IA creado${result.created === 1 ? '' : 's'}.`
                  : 'La IA no encontró fragmentos destacables en este alcance.'}
              </p>
            </div>
            {result.ocrPages > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ScanText className="w-3 h-3" />
                {result.ocrPages} página{result.ocrPages === 1 ? '' : 's'} procesada{result.ocrPages === 1 ? '' : 's'} con OCR · {result.nativePages} con texto nativo
              </p>
            )}
            {result.failedPages.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {result.failedPages.length} página{result.failedPages.length === 1 ? '' : 's'} con problemas
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-1 max-h-24 overflow-y-auto">
                  {result.failedPages.slice(0, 8).map((f) => (
                    <li key={f.page}>Página {f.page}: {f.error}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRun}
              data-testid="ai-highlight-again-btn"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Analizar de nuevo
            </Button>
          </div>
        )}

        {/* Error */}
        {error && !running && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20" data-testid="ai-highlight-error">
            <p className="text-xs font-medium text-rose-400 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              No se pudo completar el análisis
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{error}</p>
            <p className="text-[11px] text-muted-foreground mt-2">El documento sigue siendo totalmente legible.</p>
            <Button variant="outline" size="sm" className="w-full mt-3" onClick={handleRun}>
              Reintentar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
