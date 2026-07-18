import { useState } from 'react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { Button } from '../ui/Button';
import { X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StudyModeOverlayProps {
  documentId: string;
}

export const StudyModeOverlay = ({ documentId }: StudyModeOverlayProps) => {
  const { flashcards, setStudyMode } = useKnowledgeStore();
  const docCards = flashcards[documentId] || [];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = docCards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => Math.min(prev + 1, docCards.length - 1));
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  if (!currentCard) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-3xl flex flex-col items-center justify-center" data-testid="study-mode-overlay">
      <Button 
        variant="ghost" 
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10"
        onClick={() => setStudyMode(false)}
        data-testid="close-study-mode-btn"
      >
        <X className="w-6 h-6" />
      </Button>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-heading font-bold mb-2">Study Mode</h2>
        <p className="text-muted-foreground">Card {currentIndex + 1} of {docCards.length}</p>
      </div>

      <div 
        className="relative w-full max-w-2xl aspect-[3/2] cursor-pointer group perspective-1000"
        onClick={handleFlip}
        data-testid="flashcard-card"
      >
        <div className={cn(
          "w-full h-full transition-all duration-500 transform-style-3d relative",
          isFlipped ? "rotate-y-180" : ""
        )}>
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-white/5 border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-2xl">
            <span className="absolute top-6 left-6 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Front</span>
            <p className="text-3xl font-medium leading-relaxed">{currentCard.front}</p>
          </div>
          
          {/* Back */}
          <div className="absolute inset-0 backface-hidden bg-accent/10 border border-accent/20 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-2xl rotate-y-180">
            <span className="absolute top-6 left-6 text-xs uppercase tracking-widest text-accent font-semibold">Back</span>
            <p className="text-2xl leading-relaxed text-foreground/90">{currentCard.back}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 mt-12">
        <Button 
          variant="outline" 
          size="lg"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="w-16 h-16 rounded-full p-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button 
          variant="default" 
          size="lg"
          onClick={handleFlip}
          className="px-8 h-16 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-lg"
        >
          <RotateCcw className="w-5 h-5 mr-3" /> Flip Card
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          onClick={handleNext}
          disabled={currentIndex === docCards.length - 1}
          className="w-16 h-16 rounded-full p-0"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};
