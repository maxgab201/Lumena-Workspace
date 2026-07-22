import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PDFViewer } from '../components/pdf/PDFViewer';
import { OCRProgressIndicator } from '../components/pdf/OCRProgressIndicator';
import { useDocumentProcessing } from '../hooks/useDocumentProcessing';
import { useViewerStore } from '../stores/viewerStore';
import { useChatStore } from '../stores/chatStore';
import { useHighlightStore } from '../stores/highlightStore';
import { useKnowledgeStore } from '../stores/knowledgeStore';
import { DocumentRepository } from '../repositories/document.repository';
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  FileText,
  Calendar,
  HardDrive,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

interface DocumentMeta {
  id: string;
  name: string;
  size_bytes: number;
  status: string;
  file_path: string;
  workspace_id: string;
  created_at: string;
  page_count?: number | null;
  mime_type?: string | null;
  ocr_status?: string | null;
}

export const Viewer = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { reset, setDocumentId } = useViewerStore();
  const { loadSession } = useChatStore();
  const { loadHighlights, loadCategories } = useHighlightStore();
  const { loadKnowledge } = useKnowledgeStore();

  const [document, setDocument] = useState<DocumentMeta | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // OCR processing — triggers automatically if document needs client-side OCR
  const { status: ocrStatus } = useDocumentProcessing(
    documentId ?? null,
    fileUrl,
    document?.page_count ?? null,
    document?.ocr_status ?? null,
  );

  const loadDocument = useCallback(async () => {
    if (!documentId) return;

    try {
      setIsLoadingMeta(true);
      setError(null);

      // 1. Fetch document metadata from DB
      const doc = await DocumentRepository.getDocument(documentId) as DocumentMeta;
      setDocument(doc);

      // 2. Get a signed URL for the PDF file (valid for 1 hour)
      const signedUrl = await DocumentRepository.getSignedUrl(doc.file_path);
      setFileUrl(signedUrl);

      // 3. Load all per-document data in parallel (non-blocking)
      Promise.all([
        loadSession(documentId, doc.workspace_id),
        loadHighlights(documentId),
        loadCategories(doc.workspace_id),
        loadKnowledge(documentId),
      ]).catch((err) => {
        // These are non-fatal — the PDF still renders
        console.warn('[Viewer] Failed to load some document data:', err);
      });
    } catch (err: any) {
      console.error('[Viewer] Failed to load document:', err);
      setError(err?.message || 'Failed to load document');
      toast.error('Failed to load document', {
        description: err?.message || 'The document could not be loaded.',
      });
    } finally {
      setIsLoadingMeta(false);
    }
  }, [documentId, loadSession, loadHighlights, loadCategories, loadKnowledge]);

  useEffect(() => {
    reset();
    setDocumentId(documentId ?? null);
    loadDocument();
    return () => reset();
  }, [documentId, reset, setDocumentId, loadDocument]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="glass-card border border-white/5 shadow-2xl rounded-3xl p-10 max-w-md w-full text-center relative z-10">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-3">Document Not Found</h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-[280px] mx-auto">
            {error}. The file might have been deleted or you don&apos;t have access to it.
          </p>
          <Button
            variant="secondary"
            className="w-full bg-background hover:bg-background/80"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoadingMeta || !fileUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center relative bg-background overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-[100px] pointer-events-none animate-blob" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-accent/20 to-accent/5 rounded-3xl flex items-center justify-center mb-6 shadow-inner shadow-white/5 border border-white/5 relative group">
            <div className="absolute inset-0 bg-accent/20 rounded-3xl blur-xl animate-pulse opacity-50" />
            <FileText className="w-10 h-10 text-accent relative z-10 animate-pulse" strokeWidth={1.5} />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
            <h2 className="text-lg font-heading font-medium tracking-tight">Loading document...</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-2 opacity-70">
            Fetching document from secure storage
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Document Details Bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-white/5 bg-background/40 backdrop-blur-md shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard')}
          aria-label="Back to dashboard"
          className="h-8 w-8 shrink-0 hover:bg-white/5 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {document && (
          <div className="flex items-center gap-4 overflow-hidden text-xs text-muted-foreground font-medium">
            <span className="font-semibold text-sm text-foreground truncate max-w-[300px]" title={document.name}>
              {document.name}
            </span>
            <span className="flex items-center gap-1.5 shrink-0 bg-secondary/50 px-2 py-1 rounded-md border border-white/5">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              {formatDate(document.created_at)}
            </span>
            <span className="flex items-center gap-1.5 shrink-0 bg-secondary/50 px-2 py-1 rounded-md border border-white/5">
              <HardDrive className="w-3.5 h-3.5 text-accent" />
              {formatFileSize(document.size_bytes)}
            </span>
            <span className="flex items-center gap-1.5 shrink-0 bg-secondary/50 px-2 py-1 rounded-md border border-white/5">
              <Activity className="w-3.5 h-3.5 text-accent" />
              <span
                className={`capitalize tracking-wide font-semibold ${
                  document.status === 'ready'
                    ? 'text-emerald-400'
                    : document.status === 'error'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {document.status || '—'}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Main Viewer Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0">
          <PDFViewer
            fileUrl={fileUrl}
            filename={document?.name}
            fileSize={document?.size_bytes}
            documentId={documentId}
            workspaceId={document?.workspace_id}
          />
        </div>
      </div>

      {/* OCR Progress Indicator */}
      <OCRProgressIndicator
        status={ocrStatus}
        totalPages={document?.page_count}
      />
    </div>
  );
};
