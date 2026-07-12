import { useState } from 'react';
import { FlashcardsView } from './FlashcardsView';
import { GlossaryView } from './GlossaryView';
import { MindMapView } from './MindMapView';
import { TimelineView } from './TimelineView';
import { Brain, BookOpen, Network, Clock, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

interface KnowledgeSidebarProps {
  documentId: string;
  onClose: () => void;
}

type TabId = 'flashcards' | 'glossary' | 'mindmap' | 'timeline';

export const KnowledgeSidebar = ({ documentId, onClose }: KnowledgeSidebarProps) => {
  const [activeTab, setActiveTab] = useState<TabId>('flashcards');

  const tabs = [
    { id: 'flashcards', label: 'Flashcards', icon: Brain },
    { id: 'glossary', label: 'Glossary', icon: BookOpen },
    { id: 'mindmap', label: 'Mind Map', icon: Network },
    { id: 'timeline', label: 'Timeline', icon: Clock },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-background/60 backdrop-blur-3xl border-l border-white/10 w-80 shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <h2 className="font-heading font-semibold tracking-tight">Knowledge Tools</h2>
        <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={onClose} data-testid="close-knowledge-sidebar">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex p-2 gap-1 border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                isActive 
                  ? "bg-accent/20 text-accent" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'flashcards' && <FlashcardsView documentId={documentId} />}
        {activeTab === 'glossary' && <GlossaryView documentId={documentId} />}
        {activeTab === 'mindmap' && <MindMapView documentId={documentId} />}
        {activeTab === 'timeline' && <TimelineView documentId={documentId} />}
      </div>
    </div>
  );
};
