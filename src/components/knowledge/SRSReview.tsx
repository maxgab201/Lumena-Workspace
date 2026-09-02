import { useState, useCallback } from 'react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { Button } from '../ui/Button';
import { X, RotateCcw, CheckCircle, XCircle, HelpCircle, Brain, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SRSReviewProps {
  documentIds: string[];
  onClose: () => void;
}

export const SRSReview = ({ documentIds, onClose }: SRSReviewProps) => {
  const { reviewFlashcard, getAllDueFlashcards } = useKnowledgeStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [_showGrade, setShowGrade] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Get all due flashcards across selected documents
  const dueCards = getAllDueFlashcards(documentIds);
  const currentCard = dueCards[currentIndex];
  const totalCards = dueCards.length;
  const isComplete = currentIndex >= totalCards || totalCards === 0;

  // Grade options for SM-2 (0-5)
  const gradeOptions = [
    { value: 0, label: 'Again', description: 'Complete blackout', color: 'text-destructive', icon: XCircle },
    { value: 1, label: 'Hard', description: 'Incorrect, but recalled with effort', color: 'text-orange-400', icon: HelpCircle },
    { value: 2, label: 'Good', description: 'Correct with some difficulty', color: 'text-yellow-400', icon: CheckCircle },
    { value: 3, label: 'Easy', description: 'Correct with ease', color: 'text-green-400', icon: CheckCircle },
  ];

  const handleGrade = async (grade: number) => {
    if (!currentCard) return;

    setIsLoading(true);
    try {
      await reviewFlashcard(currentCard.id, currentCard.document_id || documentIds[0], grade);

      setSessionStats(prev => ({
        reviewed: prev.reviewed + 1,
        correct: prev.correct + (grade >= 3 ? 1 : 0),
      }));

      // Move to next card
      setIsFlipped(false);
      setShowGrade(false);
      setCurrentIndex(prev => prev + 1);
    } catch (err) {
      console.error('Failed to review flashcard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
    if (isFlipped) setShowGrade(true);
  }, [isFlipped]);

  if (totalCards === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-3xl flex flex-col items-center justify-center" data-testid="srs-review-overlay">
        <Button
          variant="ghost"
          className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10"
          onClick={onClose}
          data-testid="close-srs-review-btn"
        >
          <X className="w-6 h-6" />
        </Button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-2">All Caught Up!</h2>
          <p className="text-muted-foreground">No cards due for review right now.</p>
        </div>

        <Button
          variant="default"
          size="lg"
          onClick={onClose}
          className="w-48"
        >
          Done
        </Button>
      </div>
    );
  }

  if (isComplete) {
    const accuracy = sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;

    return (
      <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-3xl flex flex-col items-center justify-center" data-testid="srs-review-overlay">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-2">Session Complete!</h2>
          <p className="text-muted-foreground mb-4">
            Reviewed {sessionStats.reviewed} cards • {sessionStats.correct} correct
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground justify-center">
            <span>Accuracy: {accuracy}%</span>
            <span>Remaining due: {totalCards - currentIndex}</span>
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => { setCurrentIndex(0); setSessionStats({ reviewed: 0, correct: 0 }); }}
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Review Again
          </Button>
          <Button
            variant="default"
            size="lg"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-3xl flex flex-col" data-testid="srs-review-overlay">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-heading font-semibold tracking-tight">SRS Review</h2>
            <p className="text-xs text-muted-foreground">Card {currentIndex + 1} of {totalCards}</p>
          </div>
        </div>
        </header>

        {/* Progress Bar */}
        <div className="h-1 bg-white/5 px-4 border-b border-white/10 shrink-0">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${((currentIndex) / totalCards) * 100}%` }}
          />
        </div>

        {/* Card */}
        <main className="flex-1 flex items-center justify-center p-6">
          {currentCard && (
            <div
              className={cn(
                "relative w-full max-w-2xl aspect-[3/2] cursor-pointer group perspective-1000",
                isFlipped && "rotate-y-180"
              )}
              onClick={handleFlip}
              data-testid="srs-flashcard-card"
            >
              <div className={cn(
                "w-full h-full transition-all duration-500 transform-style-3d relative",
                isFlipped ? "rotate-y-180" : ""
              )}>
                {/* Front */}
                <div className="absolute inset-0 backface-hidden bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-2xl">
                  <span className="absolute top-6 left-6 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Question</span>
                  <p className="text-2xl font-medium leading-relaxed flex-1">{currentCard.front}</p>
                  {!isFlipped && (
                    <div className="mt-6 text-xs text-muted-foreground/70">
                      Click or press Space to flip
                    </div>
                  )}
                </div>

                {/* Back */}
                <div className="absolute inset-0 backface-hidden bg-accent/10 border border-accent/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-2xl rotate-y-180">
                  <span className="absolute top-6 left-6 text-xs uppercase tracking-widest text-accent font-semibold">Answer</span>
                  <p className="text-xl leading-relaxed text-foreground/90 flex-1">{currentCard.back}</p>
                  {currentCard.page_number && (
                    <div className="mt-4 text-xs text-accent/70">
                      Page {currentCard.page_number}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Grade Buttons */}
          {isFlipped && !isComplete && (
            <div className="p-4 border-t border-white/10 bg-background/50 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
              <p className="text-sm text-muted-foreground text-center mb-4">
                How well did you recall the answer?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {gradeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    size="lg"
                    onClick={() => handleGrade(option.value)}
                    disabled={isLoading}
                    className={cn(
                      "h-20 flex-col gap-2 text-left",
                      option.color.replace('text-', 'border-').replace('-400', '-500/50')
                    )}
                    data-testid={`grade-${option.value}`}
                  >
                    <div className={cn("font-semibold text-lg", option.color)}>
                      {option.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {option.description}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Keyboard shortcut hint */}
          <div className="px-4 py-2 text-center text-xs text-muted-foreground/60 border-t border-white/5 shrink-0">
            <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-muted-foreground">Space</kbd> to flip &nbsp;|&nbsp;
            <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-muted-foreground">1-4</kbd> to grade
          </div>
        </main>
    </div>
  );
};