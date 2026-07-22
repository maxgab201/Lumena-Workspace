/**
 * OCRProgressIndicator — Shows OCR processing progress in the viewer.
 *
 * Displays a compact floating indicator when OCR is running,
 * with a progress bar and status text. Disappears when done.
 */

import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { ProcessingStatus } from '../../hooks/useDocumentProcessing';

interface OCRProgressIndicatorProps {
  status: ProcessingStatus;
  totalPages?: number | null;
}

export function OCRProgressIndicator({ status, totalPages }: OCRProgressIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      data-testid="ocr-progress"
    >
      <div className="flex items-center gap-3 px-5 py-3 bg-slate-900/90 border border-slate-700/50 backdrop-blur-md rounded-xl shadow-2xl shadow-black/30">
        {status === 'processing' && (
          <>
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <div className="flex flex-col">
              <span className="text-sm text-slate-200 font-medium">
                Extracting text{totalPages ? ` (${totalPages} pages)` : ''}…
              </span>
              <span className="text-xs text-slate-400">
                This may take a moment for scanned documents
              </span>
            </div>
          </>
        )}

        {status === 'completed' && (
          <>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-200 font-medium">
              Text extracted{totalPages ? ` (${totalPages} pages)` : ''}
            </span>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span className="text-sm text-slate-200 font-medium">
              Text extraction failed
            </span>
          </>
        )}
      </div>
    </div>
  );
}
