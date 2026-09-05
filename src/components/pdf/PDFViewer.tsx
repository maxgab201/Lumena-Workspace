import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { PDFToolbar } from './PDFToolbar';
import { PDFPageList } from './PDFPageList';
import { HighlightEditor } from './HighlightEditor';
import { ChatSidebar } from '../chat/ChatSidebar';
import { KnowledgeSidebar } from '../knowledge/KnowledgeSidebar';
import { StudyModeOverlay } from '../knowledge/StudyModeOverlay';
import { useViewerStore } from '../../stores/viewerStore';
import { useUiStore } from '../../stores/uiStore';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { useShallow } from 'zustand/react/shallow';
import { AlertCircle, Loader2 } from 'lucide-react';

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface PDFViewerProps {
  /** Signed URL or public URL to the PDF file */
  fileUrl: string;
  /** Document filename for display */
  filename?: string;
  /** File size in bytes for display */
  fileSize?: number;
  /** Document ID for knowledge features */
  documentId?: string;
  /** Workspace ID for knowledge features */
  workspaceId?: string;
}

/**
 * The main PDF Viewer orchestrator.
 * Loads a PDF, initializes the page model, and renders the virtualized page list.
 */
export const PDFViewer = ({ fileUrl, filename, fileSize, documentId, workspaceId }: PDFViewerProps) => {
  const { initializeDocument, setLoading, totalPages, isLoading, zoomIn, zoomOut, rotate, goToNextPage, goToPrevPage, goToFirstPage, goToLastPage, setFitMode, setScale } = useViewerStore(useShallow(state => ({
    initializeDocument: state.initializeDocument,
    setLoading: state.setLoading,
    totalPages: state.totalPages,
    isLoading: state.isLoading,
    zoomIn: state.zoomIn,
    zoomOut: state.zoomOut,
    rotate: state.rotate,
    goToNextPage: state.goToNextPage,
    goToPrevPage: state.goToPrevPage,
    goToFirstPage: state.goToFirstPage,
    goToLastPage: state.goToLastPage,
    setFitMode: state.setFitMode,
    setScale: state.setScale,
  })));
  const { activeRightPanel, setActiveRightPanel } = useUiStore(useShallow(state => ({
    activeRightPanel: state.activeRightPanel,
    setActiveRightPanel: state.setActiveRightPanel,
  })));
  const { isStudyModeActive } = useKnowledgeStore(useShallow(state => ({ isStudyModeActive: state.isStudyModeActive })));
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const pdfDocRef = useRef<{ destroy: () => Promise<void> } | null>(null);

  // Configure standard options for PDF.js (cmaps, standard fonts)
  const pdfOptions = useMemo(() => ({
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  }), []);

  // Measure container dimensions immediately upon mount and on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };

    updateDimensions();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [isLoading]);

  // Cleanup PDF document on unmount
  useEffect(() => {
    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy().catch(() => undefined);
        pdfDocRef.current = null;
      }
    };
  }, []);

  // Handle successful PDF load
  const onDocumentLoadSuccess = useCallback(
    (pdf: { numPages: number; destroy: () => Promise<void> }) => {
      pdfDocRef.current = pdf;
      initializeDocument(pdf.numPages);
    },
    [initializeDocument]
  );

  const onDocumentLoadError = useCallback(
    (error: Error) => {
      console.error('[PDFViewer] Failed to load PDF:', error);
      setLoading(false);
    },
    [setLoading]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          setFitMode('fit-width');
          setScale(1.0);
          break;
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            rotate();
          }
          break;
        case 'PageDown':
          e.preventDefault();
          goToNextPage();
          break;
        case 'PageUp':
          e.preventDefault();
          goToPrevPage();
          break;
        case 'Home':
          e.preventDefault();
          goToFirstPage();
          break;
        case 'End':
          e.preventDefault();
          goToLastPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, rotate, goToNextPage, goToPrevPage, goToFirstPage, goToLastPage, setFitMode, setScale]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      <PDFToolbar
        filename={filename}
        fileSize={fileSize}
        pageCount={totalPages || undefined}
      />

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          options={pdfOptions}
          error={(
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center h-full w-full">
              <AlertCircle className="h-10 w-10 text-rose-400" />
              <p className="font-medium text-foreground text-lg">This PDF could not be opened.</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                The file may be damaged or temporarily unavailable. Return to Documents and try again.
              </p>
            </div>
          )}
          className="flex-1 flex flex-col min-h-0 relative h-full w-full overflow-hidden"
        >
          <HighlightEditor />

          {/* Main Document Content */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center h-full w-full bg-background">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-sm text-muted-foreground">Loading document…</p>
              </div>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="flex-1 bg-muted/20 relative overflow-hidden h-full w-full"
              data-testid="pdf-container"
              data-width={dimensions.width}
              data-height={dimensions.height}
            >
              {dimensions.width > 0 && dimensions.height > 0 ? (
                <PDFPageList
                  containerWidth={dimensions.width}
                  containerHeight={dimensions.height}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </div>
              )}
            </div>
          )}
        </Document>

        {activeRightPanel === 'chat' && <ChatSidebar />}
        {activeRightPanel === 'knowledge' && (
          <KnowledgeSidebar 
            documentId={documentId ?? fileUrl}
            workspaceId={workspaceId ?? ''}
            onClose={() => setActiveRightPanel('none')} 
          />
        )}
      </div>

      {isStudyModeActive && <StudyModeOverlay documentId={documentId ?? fileUrl} />}
    </div>
  );
};
