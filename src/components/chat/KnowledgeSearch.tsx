import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, Loader2, FileText, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { cn } from '../../lib/utils';
import { formatSimilarity, parseKnowledgeSearchResponse, type KnowledgeSearchResult as SearchResult } from '../../lib/knowledgeSearch';

interface KnowledgeSearchProps {
  onSelectResult?: (result: SearchResult) => void;
  className?: string;
}

export const KnowledgeSearch = ({
  onSelectResult,
  className
}: KnowledgeSearchProps) => {
  // Subscribed, not read once per render: a search must never run against a workspace the user left.
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspace?.id);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [textOnly, setTextOnly] = useState(false);
  // The query a finished search was run for: "no results" is only true for that exact text, not
  // for whatever is being typed (it used to show up after the first keystroke, before any search).
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the latest search may write its answer: a slow earlier one (or one that was started in
  // another workspace) would otherwise overwrite what the user is looking at.
  const searchSeq = useRef(0);

  useEffect(() => {
    searchSeq.current += 1;
    setResults([]);
    setTextOnly(false);
    setSearchedQuery(null);
    setError(null);
    setIsLoading(false);
  }, [workspaceId]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !workspaceId) return;

    const seq = ++searchSeq.current;
    setIsLoading(true);
    setError(null);

    try {
      const session = await supabase.auth.getSession();
      const { data: { session: currentSession } } = session;

      if (!currentSession) {
        throw new Error('No active session');
      }

      // Call the rag-retrieve edge function for search
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-retrieve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          query,
          workspace_id: workspaceId,
          limit: 10,
          similarity_threshold: 0.6,
          semantic_weight: 0.7,
          keyword_weight: 0.3,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Search failed: ${response.status}`);
      }

      const parsed = parseKnowledgeSearchResponse(await response.json());
      if (seq !== searchSeq.current) return;
      setResults(parsed.results);
      setTextOnly(parsed.degraded);
      setSearchedQuery(query);
    } catch (err) {
      if (seq !== searchSeq.current) return;
      console.error('Knowledge search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setTextOnly(false);
    } finally {
      if (seq === searchSeq.current) setIsLoading(false);
    }
  }, [query, workspaceId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    searchSeq.current += 1;
    setQuery('');
    setResults([]);
    setTextOnly(false);
    setSearchedQuery(null);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search documents..."
          className="w-full pl-10 pr-10 py-2 text-sm bg-muted/30 border border-white/5 rounded-lg
            placeholder:text-muted-foreground/50
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30
            transition-colors"
          disabled={isLoading}
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive/80">{error}</p>
      )}

      {textOnly && !error && (
        <p className="text-[11px] text-muted-foreground/70" data-testid="knowledge-search-text-only">
          Showing text matches: AI semantic search is unavailable right now.
        </p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.map((result, _idx) => (
            <button
              key={`${result.document_id}-${result.chunk_index}`}
              onClick={() => onSelectResult?.(result)}
              className={cn(
                "w-full text-left p-3 rounded-lg border border-white/5",
                "bg-background/50 hover:bg-muted/30 hover:border-white/10",
                "transition-colors text-sm",
                "flex flex-col gap-1.5"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <span className="font-medium truncate">{result.document_name}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </div>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground pl-6">
                <span className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                  Page {result.page_number}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-muted border border-white/5 text-[9px]">
                  {result.match_type}
                </span>
                {formatSimilarity(result) && <span className="text-[10px]">{formatSimilarity(result)}</span>}
              </div>

              <p className="text-[12px] text-muted-foreground/70 line-clamp-2 pl-6">
                {result.chunk_text?.substring(0, 200) || ''}
                {result.chunk_text && result.chunk_text.length > 200 && '…'}
              </p>
            </button>
          ))}
        </div>
      )}

      {searchedQuery !== null && searchedQuery === query && !isLoading && results.length === 0 && !error && (
        <p className="text-sm text-muted-foreground/60 text-center py-4">
          No results found for "{query}"
        </p>
      )}
    </div>
  );
};