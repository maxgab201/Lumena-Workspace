import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { useBillingStore } from '../../stores/billingStore';
import { Button } from '../ui/Button';
import { Network, Sparkles, Loader2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import type { MindMapNode } from '../../types/knowledge';

interface MindMapViewProps {
  documentId: string;
  workspaceId: string;
}

export const MindMapView = ({ documentId, workspaceId }: MindMapViewProps) => {
  const { mindMapNodes, generateMindMap, isGenerating } = useKnowledgeStore();
  const { fetchBillingData } = useBillingStore();

  const nodes: MindMapNode[] = mindMapNodes[documentId] || [];
  const rootNode = nodes.find((n) => !n.parent_id);
  const childNodes = nodes.filter((n) => !!n.parent_id);

  const handleGenerate = async () => {
    try {
      await generateMindMap(documentId, workspaceId);
      await fetchBillingData();
      toast.success('Mind Map generated!', { description: 'Document structure mapped by AI.' });
    } catch (err: any) {
      toast.error('Generation failed', { description: err.message });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {nodes.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
              <Network className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Mind Map</h3>
              <p className="text-sm text-muted-foreground">
                Generate a visual map of your document's structure with AI.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Root node */}
            {rootNode && (
              <div className="flex flex-col items-center">
                <div className="px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-semibold shadow-lg shadow-accent/20 text-center max-w-xs">
                  {rootNode.label}
                </div>
                {/* Connector line */}
                {childNodes.length > 0 && (
                  <div className="w-px h-6 bg-white/20 my-1" />
                )}
              </div>
            )}
            
            {/* Child nodes grid */}
            {childNodes.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {childNodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-accent/30 transition-colors"
                  >
                    <Circle className="w-2 h-2 text-accent shrink-0 mt-1.5 fill-accent" />
                    <span className="text-xs text-foreground leading-snug">{node.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/10 bg-background/50">
        <Button 
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={handleGenerate}
          disabled={isGenerating}
          data-testid="generate-mindmap-btn"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {isGenerating ? 'Generating...' : nodes.length > 0 ? 'Regenerate Map' : 'Generate with AI'}
        </Button>
      </div>
    </div>
  );
};
