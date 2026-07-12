import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PDFViewer } from '../components/pdf/PDFViewer';
import { useViewerStore } from '../stores/viewerStore';
import { apiService } from '../services/api.service';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, FileText, Calendar, HardDrive, Activity } from 'lucide-react';
import { Button } from '../components/ui/Button';
import type { Document } from '../types';

export const Viewer = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { reset, setDocumentId } = useViewerStore();

  const [document, setDocument] = useState<Document | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch document metadata and signed URL
  useEffect(() => {
    if (!documentId) return;

    reset();
    setDocumentId(documentId);

    const loadDocument = async () => {
      try {
        setIsLoadingMeta(true);
        setError(null);

        // 1. Fetch document record
        const doc = await apiService.getDocument(documentId);
        setDocument(doc);

        // 2. Get signed URL for the PDF file
        const url = await apiService.getDocumentSignedUrl(doc.file_path);
        setFileUrl(url);
      } catch (err: any) {
        console.error('Failed to load document:', err);
        setError(err?.message || 'Failed to load document');
        toast.error('Failed to load document', {
          description: err?.message || 'The document could not be loaded.',
        });
      } finally {
        setIsLoadingMeta(false);
      }
    };

    loadDocument();

    return () => reset();
  }, [documentId, reset, setDocumentId]);

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
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center space-y-4">
          <FileText className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-heading font-semibold">Document not found</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoadingMeta || !fileUrl) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading document…</p>
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
          className="h-8 w-8 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-4 overflow-hidden text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 shrink-0">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(document?.created_at)}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <HardDrive className="w-3.5 h-3.5" />
            {formatFileSize(document?.size_bytes)}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <Activity className="w-3.5 h-3.5" />
            <span className={`capitalize ${document?.status === 'ready' ? 'text-green-400' : document?.status === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
              {document?.status || '—'}
            </span>
          </span>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* PDF Content (main area) */}
        <div className="flex-1 flex flex-col min-w-0">
          <PDFViewer
            fileUrl={fileUrl}
            filename={document?.name}
            fileSize={document?.size_bytes}
          />
        </div>

        {/* Future Right Sidebar (OCR, AI, Notes) — Empty placeholder */}
        <div
          className="hidden lg:block w-0 border-l border-white/5 bg-background/20 backdrop-blur-sm transition-all duration-300"
          data-region="viewer-sidebar"
        />
      </div>
    </div>
  );
};
