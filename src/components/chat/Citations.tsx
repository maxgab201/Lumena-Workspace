import { FileText, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Citation {
  document_id: string;
  document_name: string;
  page_number: number;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
  match_type: string;
}

interface CitationsProps {
  citations: Citation[];
  onNavigateToPage?: (pageNumber: number) => void;
  onOpenDocument?: (documentId: string) => void;
}

export const Citations = ({
  citations,
  onNavigateToPage,
  onOpenDocument
}: CitationsProps) => {
  if (!citations || citations.length === 0) return null;

  return (
    <details className="group w-full mt-3" data-testid="citations">
      <summary className={cn(
        "flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground",
        "rounded-lg bg-muted/30 border border-white/5 cursor-pointer",
        "transition-colors hover:text-foreground hover:bg-muted/50",
        "select-none"
      )}>
        <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90 text-muted-foreground/50" />
        <FileText className="h-3 w-3 shrink-0" />
        <span>Sources ({citations.length})</span>
      </summary>

      <div className="mt-2 space-y-2 px-1 animate-in fade-in-0 duration-150">
        {citations.map((citation, idx) => (
          <div
            key={`${citation.document_id}-${citation.chunk_index}`}
            className={cn(
              "rounded-md border border-white/5 bg-background/50 p-3",
              "transition-colors hover:border-white/10"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={cn(
                  "inline-flex items-center justify-center shrink-0",
                  "rounded-full border border-primary/30 bg-primary/10 text-primary",
                  "text-[10px] font-medium w-5 h-5"
                )}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {citation.document_name || 'Unknown Document'}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-0.5">
                      <FileText className="h-2.5 w-2.5" />
                      Page {citation.page_number || '?'}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-muted border border-white/5">
                        {citation.match_type || 'hybrid'}
                      </span>
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px]">
                      {(citation.similarity * 100).toFixed(0)}% match
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onNavigateToPage && (
                  <button
                    onClick={() => onNavigateToPage(citation.page_number)}
                    className={cn(
                      "p-1.5 rounded hover:bg-white/5",
                      "text-muted-foreground hover:text-foreground",
                      "transition-colors"
                    )}
                    title="Go to page"
                    aria-label={`Go to page ${citation.page_number}`}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {onOpenDocument && (
                  <button
                    onClick={() => onOpenDocument(citation.document_id)}
                    className={cn(
                      "p-1.5 rounded hover:bg-white/5",
                      "text-muted-foreground hover:text-foreground",
                      "transition-colors"
                    )}
                    title="Open document"
                    aria-label={`Open ${citation.document_name}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground/80 leading-relaxed border-t border-white/5 pt-2">
              {citation.chunk_text?.substring(0, 300) || ''}
              {citation.chunk_text && citation.chunk_text.length > 300 && '…'}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
};