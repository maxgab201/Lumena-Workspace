import { useState } from 'react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { Button } from '../ui/Button';
import { Plus, Brain } from 'lucide-react';
import { Textarea } from '../ui/Textarea';

interface FlashcardsViewProps {
  documentId: string;
  workspaceId: string;
}

export const FlashcardsView = ({ documentId, workspaceId }: FlashcardsViewProps) => {
  const { flashcards, addFlashcard, setStudyMode } = useKnowledgeStore();
  const [isAdding, setIsAdding] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  const docCards = flashcards[documentId] || [];

  const handleSave = () => {
    if (!front.trim() || !back.trim()) return;
    addFlashcard(documentId, workspaceId, { front: front.trim(), back: back.trim() });
    setFront('');
    setBack('');
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {docCards.length === 0 && !isAdding ? (
          <div className="text-center text-muted-foreground mt-8 text-sm">
            No flashcards yet. Create one or ask AI to generate them.
          </div>
        ) : (
          docCards.map((card) => (
            <div key={card.id} className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase">Front</div>
              <p className="text-sm">{card.front}</p>
              <div className="h-px w-full bg-white/10" />
              <div className="text-xs font-medium text-muted-foreground uppercase">Back</div>
              <p className="text-sm">{card.back}</p>
            </div>
          ))
        )}

        {isAdding && (
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-3" data-testid="new-flashcard-form">
            <Textarea 
              placeholder="Front side (Question)..." 
              value={front} 
              onChange={(e) => setFront(e.target.value)}
              className="text-sm resize-none bg-background/50"
              rows={2}
              data-testid="flashcard-front-input"
            />
            <Textarea 
              placeholder="Back side (Answer)..." 
              value={back} 
              onChange={(e) => setBack(e.target.value)}
              className="text-sm resize-none bg-background/50"
              rows={3}
              data-testid="flashcard-back-input"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} data-testid="save-flashcard-btn">Save</Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-white/10 bg-background/50 flex gap-2">
        {!isAdding && (
          <Button 
            className="flex-1" 
            variant="outline" 
            onClick={() => setIsAdding(true)}
            data-testid="add-flashcard-btn"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Card
          </Button>
        )}
        <Button 
          className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground" 
          disabled={docCards.length === 0}
          onClick={() => setStudyMode(true)}
          data-testid="start-study-mode-btn"
        >
          <Brain className="w-4 h-4 mr-2" /> Study Mode
        </Button>
      </div>
    </div>
  );
};
