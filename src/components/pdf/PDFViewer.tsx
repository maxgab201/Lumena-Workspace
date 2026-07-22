import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Loader2 } from 'lucide-react';

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
  const { initializeDocument, setLoading, totalPages, isLoading, zoomIn, zoomOut, rotate, goToNextPage, goToPrevPage, goToFirstPage, goToLastPage, setFitMode, setScale } = useViewerStore();
  const { activeRightPanel, setActiveRightPanel } = useUiStore();
  const { isStudyModeActive } = useKnowledgeStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Measure container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        if (width === 0 || height === 0) {
          console.log(`[DEBUG] Viewer dimensions: width=${width}, height=${height}`);
        }
        
        setDimensions({ width, height });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Handle successful PDF load
  const onDocumentLoadSuccess = useCallback(
    async (pdf: { numPages: number; getPageLabels?: () => Promise<string[] | null> }) => {
      try {
        // We removed pageLabels from initializeDocument since we'll set it per-page when OCR runs
      } catch (err) {
        console.warn('Could not read page labels', err);
      }
      initializeDocument(pdf.numPages);
    },
    [initializeDocument]
  );

  const onDocumentLoadError = useCallback(
    (error: Error) => {
      console.error('Failed to load PDF:', error);
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
    <div className="flex flex-col h-full w-full">
      <PDFToolbar
        filename={filename}
        fileSize={fileSize}
        pageCount={totalPages || undefined}
      />

      <div className="flex-1 flex min-h-0 relative">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="flex-1 flex flex-col min-h-0 bg-background relative"
        >
          <HighlightEditor workspaceId={workspaceId} />

          {/* Main Document Content */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-sm text-muted-foreground">Loading document…</p>
              </div>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="flex-1 bg-muted/20 relative overflow-hidden"
              data-testid="pdf-container"
              data-width={dimensions.width}
              data-height={dimensions.height}
            >
              {/* eslint-disable-next-line no-constant-binary-expression */}
              {(dimensions.width > 0 || true) && (
                <PDFPageList
                  containerWidth={Math.max(dimensions.width, 800)}
                  containerHeight={Math.max(dimensions.height, 600)}
                />
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

      {isStudyModeActive && <StudyModeOverlay documentId={fileUrl} />}
    </div>
  );
};
