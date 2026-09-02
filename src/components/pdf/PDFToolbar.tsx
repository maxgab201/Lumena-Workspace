import { useState, useEffect, useRef } from 'react';
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
  Brain,
  Search,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';

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
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearchActive,
    setIsSearchActive,
  } = useViewerStore();

  const { activeRightPanel, setActiveRightPanel } = useUiStore();

  const [pageInput, setPageInput] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
    setPageInput('');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim()) {
      setIsSearchActive(true);
    } else {
      setIsSearchActive(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
  };

  const goToNextMatch = () => {
    const { searchResults } = useViewerStore.getState();
    if (searchResults.length > 0) {
      // const _nextIndex = (currentMatchIndex + 1) % searchResults.length;
    }
  };

  const goToPrevMatch = () => {
    const { searchResults } = useViewerStore.getState();
    if (searchResults.length > 0) {
      // Navigate to previous match
    }
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
      setScale(1.0);
    }
  };

  // Render search component separately to avoid ternary parsing issues
  const SearchComponent = () => {
    if (!isSearchOpen) return null;

    return (
      <div className="relative flex items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeSearch();
              if (e.key === 'Enter' && e.shiftKey) goToPrevMatch();
              if (e.key === 'Enter' && !e.shiftKey) goToNextMatch();
            }}
            placeholder="Search in document... (Esc to close)"
            className="w-full pl-9 pr-9 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all"
            autoFocus
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => { setSearchQuery(''); setIsSearchActive(false); }}
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </form>
        <div className="flex items-center gap-1 ml-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevMatch}
                disabled={!isSearchActive || searchResults.length === 0}
                aria-label="Previous match"
                className="h-8 w-8"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Previous match <kbd className="bg-white/10 px-1 rounded">⇧Enter</kbd></p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextMatch}
                disabled={!isSearchActive || searchResults.length === 0}
                aria-label="Next match"
                className="h-8 w-8"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Next match <kbd className="bg-white/10 px-1 rounded">Enter</kbd></p></TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSearch}
            aria-label="Close search"
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
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
              value={pageInput || currentPage}
              onChange={(e) => setPageInput(e.target.value)}
              onFocus={() => setPageInput(String(currentPage))}
              onBlur={() => setPageInput('')}
              className="w-10 h-8 text-center text-sm font-medium rounded-md border-none bg-background/50 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all"
              aria-label="Current page"
            />
            <span className="text-sm text-muted-foreground font-medium px-1">
              / {totalPages || pageCount || '—'}
            </span>
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
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 ml-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Search in document"
                className="h-8 w-8"
              >
                <Search className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Search <kbd className="bg-white/10 px-1 rounded">⌘F</kbd></p></TooltipContent>
          </Tooltip>

          <SearchComponent />

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
            <TooltipContent><p className="flex items-center gap-2">{fitMode === 'fit-width' ? 'Fit to page' : 'Fit to width'} <kbd className="bg-white/10 px-1 rounded">F</kbd></p></TooltipContent>
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
                variant={showOverlays ? "secondary" : "ghost"}
                size="icon"
                onClick={toggleOverlays}
                aria-label="Toggle developer overlays"
                className="h-8 w-8 relative group"
              >
                {showOverlays && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                )}
                <Layers className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="flex items-center gap-2">Developer Overlays <kbd className="bg-white/10 px-1 rounded">O</kbd></p></TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />

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
            <TooltipContent><p className="flex items-center gap-2">Knowledge Graph <kbd className="bg-white/10 px-1 rounded">K</kbd></p></TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};