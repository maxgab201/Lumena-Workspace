import { useState } from 'react';
import { useViewerStore } from '../../stores/viewerStore';
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
  Layers,
  MessageSquare,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';

interface PDFToolbarProps {
  filename?: string;
  fileSize?: number;
  pageCount?: number;
}

export const PDFToolbar = ({ filename, fileSize, pageCount }: PDFToolbarProps) => {
  const {
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
    showOverlays,
    toggleOverlays,
  } = useViewerStore();

  const { isChatOpen, toggleChat } = useChatStore();

  const [pageInput, setPageInput] = useState('');

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
    setPageInput('');
  };

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
      // Reset to a reasonable default when switching to fit-width
      setScale(1.0);
    }
  };

  return (
    <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-background/60 backdrop-blur-xl shrink-0 z-20">
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
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevPage}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="h-8 w-8"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <form onSubmit={handlePageSubmit} className="flex items-center gap-1">
          <input
            type="text"
            value={pageInput || currentPage}
            onChange={(e) => setPageInput(e.target.value)}
            onFocus={() => setPageInput(String(currentPage))}
            onBlur={() => setPageInput('')}
            className="w-12 h-8 text-center text-sm rounded-lg border border-white/10 bg-background/30 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label="Current page"
          />
          <span className="text-sm text-muted-foreground">
            / {totalPages || pageCount || '—'}
          </span>
        </form>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextPage}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="h-8 w-8"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Right: Zoom & Tools */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={zoomOut}
          aria-label="Zoom out"
          className="h-8 w-8"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>

        <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={zoomIn}
          aria-label="Zoom in"
          className="h-8 w-8"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />

        <Button
          variant="ghost"
          size="icon"
          onClick={handleFitToggle}
          aria-label={fitMode === 'fit-width' ? 'Fit to page' : 'Fit to width'}
          className="h-8 w-8"
          title={fitMode === 'fit-width' ? 'Fit to page' : 'Fit to width'}
        >
          {fitMode === 'fit-width' ? (
            <Maximize className="w-4 h-4" />
          ) : (
            <ChevronsLeftRight className="w-4 h-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={rotate}
          aria-label="Rotate clockwise"
          className="h-8 w-8"
        >
          <RotateCw className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />

        <Button
          variant={showOverlays ? "secondary" : "ghost"}
          size="icon"
          onClick={toggleOverlays}
          aria-label="Toggle developer overlays"
          className="h-8 w-8"
          title="Toggle developer overlays"
        >
          <Layers className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />

        <Button
          variant={isChatOpen ? "secondary" : "ghost"}
          size="icon"
          onClick={toggleChat}
          aria-label="Toggle Chat"
          className="h-8 w-8"
          title="Toggle Chat"
          data-testid="toggle-chat-btn"
        >
          <MessageSquare className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
