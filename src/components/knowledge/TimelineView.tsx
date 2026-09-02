import { useState } from 'react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { useBillingStore } from '../../stores/billingStore';
import { Button } from '../ui/Button';
import { Sparkles, Loader2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface TimelineViewProps {
  documentId: string;
  workspaceId: string;
}

export const TimelineView = ({ documentId, workspaceId }: TimelineViewProps) => {
  const { timelineEvents, deleteTimelineEvent } = useKnowledgeStore();
  const { fetchBillingData } = useBillingStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const docEvents = timelineEvents[documentId] || [];

  // Sort events chronologically
  const sortedEvents = [...docEvents].sort((a, b) =>
    new Date(a.date_str).getTime() - new Date(b.date_str).getTime()
  );

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // The edge function uses 'timeline' action type
      const { supabase } = await import('../../lib/supabase');
      const { data, error } = await supabase.functions.invoke('generate-knowledge', {
        body: { document_id: documentId, workspace_id: workspaceId, action_type: 'timeline' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await fetchBillingData();
      toast.success('Timeline generated!', { description: 'Chronological events extracted from your document.' });
    } catch (err: any) {
      toast.error('Generation failed', { description: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTimelineEvent(id, documentId);
      toast.success('Event deleted');
    } catch (err: any) {
      toast.error('Failed to delete', { description: err.message });
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {sortedEvents.length === 0 ? (
        <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-1">Timeline</h3>
            <p className="text-sm text-muted-foreground">
              Extract chronological events from your document with AI.
            </p>
          </div>
          <Button
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={handleGenerate}
            disabled={isGenerating}
            data-testid="generate-timeline-btn"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {isGenerating ? 'Generating...' : 'Generate with AI'}
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/10" />
          {sortedEvents.map((event, index) => (
            <div
              key={event.id}
              className="relative flex items-start gap-4 group"
              data-testid={`timeline-event-${event.id}`}
            >
              {/* Timeline dot and line */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className={cn(
                  "w-4 h-4 rounded-full border-3 bg-background border-accent z-10",
                  "shadow-[0_0_0_4px_rgba(139,92,246,0.3)]"
                )} />
                {index < sortedEvents.length - 1 && (
                  <div className="w-0.5 flex-1 bg-white/10 mt-1" />
                )}
              </div>

              {/* Event card */}
              <div className="flex-1 min-w-0">
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-accent font-medium mb-1">
                        <span className="text-muted-foreground">{formatDate(event.date_str)}</span>
                        {event.page_number && (
                          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px]">
                            p.{event.page_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{event.description}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => toggleExpanded(event.id)}
                        className="p-1.5 rounded hover:bg-white/5 transition-colors"
                        aria-label={expandedIds.has(event.id) ? 'Collapse' : 'Expand'}
                      >
                        {expandedIds.has(event.id) ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                        className="p-1.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors text-muted-foreground"
                        aria-label="Delete event"
                      >
                        <ChevronDown className="w-4 h-4 rotate-90" /> {/* Using ChevronDown as trash alternative */}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedIds.has(event.id) && (
                    <div className="mt-3 pt-3 border-t border-white/5 text-xs text-muted-foreground space-y-1">
                      <div className="flex gap-3">
                        <span>Created: {new Date(event.created_at).toLocaleString()}</span>
                        <span>ID: {event.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 border-t border-white/10 bg-background/50">
        <Button
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={handleGenerate}
          disabled={isGenerating}
          data-testid="generate-timeline-btn"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {isGenerating ? 'Generating...' : sortedEvents.length > 0 ? 'Regenerate Timeline' : 'Generate with AI'}
        </Button>
      </div>
    </div>
  );
};