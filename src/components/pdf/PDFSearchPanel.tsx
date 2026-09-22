import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { useViewerStore } from '../../stores/viewerStore';
import { useShallow } from 'zustand/react/shallow';
import { DocumentSearchRepository, type DocumentSearchHit } from '../../repositories/document-search.repository';
import { Button } from '../ui/Button';

interface PDFSearchPanelProps {
  documentId?: string;
  onClose: () => void;
}

export const PDFSearchPanel = ({ documentId, onClose }: PDFSearchPanelProps) => {
  const { pageLabels, setCurrentPage } = useViewerStore(useShallow((state) => ({
    pageLabels: state.pageLabels,
    setCurrentPage: state.setCurrentPage,
  })));

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DocumentSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const clean = query.trim();
    if (!documentId || clean.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const hits = await DocumentSearchRepository.search(documentId, clean);
        if (!controller.signal.aborted) setResults(hits);
      } catch (searchError) {
        console.error('[PDFSearchPanel] search failed:', searchError);
        if (!controller.signal.aborted) setError('No se pudo buscar en el documento.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [documentId, query]);

  const resultCount = useMemo(
    () => results.reduce((total, result) => total + result.matchCount, 0),
    [results],
  );

  return (
    <div
      className="absolute left-1/2 top-full z-50 mt-2 w-[min(540px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-background/95 shadow-2xl backdrop-blur-2xl"
      data-testid="pdf-search-panel"
    >
      <div className="flex items-center gap-2 border-b border-white/10 p-3">
        <Search className="h-4 w-4 text-accent" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
          }}
          placeholder="Buscar texto en este PDF…"
          aria-label="Search query"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close search">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2">
        {error ? (
          <p className="p-4 text-center text-sm text-rose-400">{error}</p>
        ) : query.trim().length < 2 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Escribí al menos 2 caracteres. Busca tanto texto nativo como OCR.
          </p>
        ) : !loading && results.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No encontré coincidencias.</p>
        ) : (
          <>
            <div className="px-2 py-1 text-[11px] text-muted-foreground">
              {resultCount} coincidencia{resultCount === 1 ? '' : 's'} en {results.length} página{results.length === 1 ? '' : 's'}
            </div>
            {results.map((result) => {
              const label = pageLabels[result.pageNumber - 1] ?? String(result.pageNumber);
              const logicalDiffers = label !== String(result.pageNumber);
              return (
                <button
                  key={result.pageNumber}
                  type="button"
                  className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                  onClick={() => {
                    setCurrentPage(result.pageNumber);
                    onClose();
                  }}
                  data-testid={`pdf-search-result-${result.pageNumber}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-accent">
                      Página {label}
                      {logicalDiffers && <span className="ml-1 font-normal text-muted-foreground">(PDF {result.pageNumber})</span>}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {result.matchCount}× · {result.source === 'ocr' ? 'OCR' : 'texto'}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{result.snippet}</p>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
