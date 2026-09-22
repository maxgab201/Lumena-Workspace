import { useState } from 'react';
import { useViewerStore } from '../../stores/viewerStore';
import { useHighlightStore } from '../../stores/highlightStore';
import { Button } from '../ui/Button';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Maximize,
  ChevronsLeftRight,
  FileText,
  MessageSquare,
  Brain,
  Highlighter,
  Sparkles,
  Search,
} from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';
import { PageMapEditor } from './PageMapEditor';
import { PDFSearchPanel } from './PDFSearchPanel';
import { hasLogicalPageLabels } from '../../lib/pageMapping';

interface PDFToolbarProps {
  filename?: string;
  fileSize?: number;
  pageCount?: number;
  documentId?: string;
  workspaceId?: string;
}

export const PDFToolbar = ({ filename, fileSize, pageCount, documentId, workspaceId }: PDFToolbarProps) => {
  const {
    documentId,
    currentPage,
    totalPages,
    scale,
    fitMode,
    zoomIn,
    zoomOut,
    rotate,
    goToNextPage,
    goToPrevPage,
    setCurrentPage,
    setFitMode,
    setScale,
    pageLabels,
    resolvePageReference,
  } = useViewerStore();

  const { activeRightPanel, setActiveRightPanel } = useUiStore();
  const highlightCount = useHighlightStore((state) =>
    documentId ? state.highlights[documentId]?.length ?? 0 : 0
  );

  const [pageInput, setPageInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = resolvePageReference(pageInput);
    if (page) setCurrentPage(page);
    setPageInput('');
  };

  const currentPageLabel = pageLabels[currentPage - 1] ?? String(currentPage);
  const lastPageLabel = pageLabels[totalPages - 1] ?? String(totalPages || pageCount || '—');
  const logicalLabelsActive = hasLogicalPageLabels(pageLabels);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFitToggle = () => {
    if (fitMode === 'fit-width') {
      setFitMode('fit-page');
    } else {
      setFitMode('fit-width');
      setScale(1.0);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative h-14 flex items-center justify-between px-4 border-b border-white/5 bg-background/60 backdrop-blur-xl shrink-0 z-20">
        {/* Left: Document Info */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink">
          <FileText className="w-4 h-4 text-accent shrink-0" />
          <span className="text-sm font-medium truncate max-w-[200px]" title={filename}>
            {filename || 'Document'}
          </span>
          {fileSize ? (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {formatFileSize(fileSize)}
            </span>
          ) : null}
        </div>

        {/* Center: Page Navigation */}
        <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-xl border border-white/5 flex-1 max-w-[400px] mx-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className="h-8 w-8 hover:bg-background/80"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Previous page <kbd className="bg-white/10 px-1 rounded">←</kbd></p></TooltipContent>
          </Tooltip>

          <form onSubmit={handlePageSubmit} className="flex items-center gap-1 px-1">
            <input
              type="text"
              value={pageInput || currentPageLabel}
              onChange={(e) => setPageInput(e.target.value)}
              onFocus={() => setPageInput(currentPageLabel)}
              onBlur={() => setPageInput('')}
              className="w-10 h-8 text-center text-sm font-medium rounded-md border-none bg-background/50 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all"
              aria-label="Current page"
            />
            <span className="text-sm text-muted-foreground font-medium px-1" title={logicalLabelsActive ? `PDF ${currentPage} / ${totalPages}` : undefined}>
              / {lastPageLabel}
            </span>
            {logicalLabelsActive && (
              <span className="hidden lg:inline text-[10px] text-muted-foreground/70 whitespace-nowrap" data-testid="physical-page-indicator">
                PDF {currentPage}/{totalPages}
              </span>
            )}
          </form>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="h-8 w-8 hover:bg-background/80"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Next page <kbd className="bg-white/10 px-1 rounded">→</kbd></p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <PageMapEditor documentId={documentId} workspaceId={workspaceId} />
              </span>
            </TooltipTrigger>
            <TooltipContent><p>Corregir numeración del libro</p></TooltipContent>
          </Tooltip>
        </div>

        {/* Right: Zoom & Tools */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomOut}
                aria-label="Zoom out"
                className="h-8 w-8"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Zoom Out <kbd className="bg-white/10 px-1 rounded">-</kbd></p></TooltipContent>
          </Tooltip>

          <span className="text-xs text-muted-foreground font-medium w-12 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomIn}
                aria-label="Zoom in"
                className="h-8 w-8"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Zoom In <kbd className="bg-white/10 px-1 rounded">+</kbd></p></TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFitToggle}
                aria-label={fitMode === 'fit-width' ? 'Fit to page' : 'Fit to width'}
                className="h-8 w-8"
              >
                {fitMode === 'fit-width' ? (
                  <Maximize className="w-4 h-4" />
                ) : (
                  <ChevronsLeftRight className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">{fitMode === 'fit-width' ? 'Fit to page' : 'Fit to width'} <kbd className="bg-white/10 px-1 rounded">0</kbd></p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={rotate}
                aria-label="Rotate clockwise"
                className="h-8 w-8"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Rotate <kbd className="bg-white/10 px-1 rounded">R</kbd></p></TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showSearch ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setShowSearch((value) => !value)}
                aria-label="Search in document"
                className="h-8 w-8"
                data-testid="pdf-search-trigger"
              >
                <Search className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Buscar en el PDF</p></TooltipContent>
          </Tooltip>

          {/* AI Highlighting panel trigger */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeRightPanel === 'ai' ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setActiveRightPanel(activeRightPanel === 'ai' ? 'none' : 'ai')}
                aria-label="Subrayar con IA"
                className="h-8 w-8"
                data-testid="toggle-ai-highlight-btn"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Subrayar con IA <kbd className="bg-white/10 px-1 rounded">I</kbd></p></TooltipContent>
          </Tooltip>

          {/* Annotations & Notes panel trigger */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeRightPanel === 'annotations' ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setActiveRightPanel(activeRightPanel === 'annotations' ? 'none' : 'annotations')}
                aria-label="Anotaciones y notas"
                className="h-8 w-8 relative"
                data-testid="toggle-annotations-btn"
              >
                <Highlighter className="w-4 h-4" />
                {highlightCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-[9px] font-bold text-background rounded-full flex items-center justify-center">
                    {highlightCount > 9 ? '9+' : highlightCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Anotaciones <kbd className="bg-white/10 px-1 rounded">A</kbd></p></TooltipContent>
          </Tooltip>

          {/* AI Chat panel trigger */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeRightPanel === 'chat' ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setActiveRightPanel(activeRightPanel === 'chat' ? 'none' : 'chat')}
                aria-label="Toggle Chat"
                className="h-8 w-8"
                data-testid="toggle-chat-btn"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">AI Chat <kbd className="bg-white/10 px-1 rounded">C</kbd></p></TooltipContent>
          </Tooltip>

          {/* Knowledge tools trigger */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeRightPanel === 'knowledge' ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setActiveRightPanel(activeRightPanel === 'knowledge' ? 'none' : 'knowledge')}
                aria-label="Knowledge Tools"
                className="h-8 w-8"
                data-testid="toggle-knowledge-btn"
              >
                <Brain className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Knowledge tools</p></TooltipContent>
          </Tooltip>

        </div>

        {showSearch && (
          <PDFSearchPanel
            documentId={documentId}
            onClose={() => setShowSearch(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
};
