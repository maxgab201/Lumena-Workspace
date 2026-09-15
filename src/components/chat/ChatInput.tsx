import { useState } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '../ui/Button';
import { useViewerStore } from '../../stores/viewerStore';
import { useShallow } from 'zustand/react/shallow';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
}

export const ChatInput = ({ onSend, onStop, disabled, isGenerating }: ChatInputProps) => {
  const [value, setValue] = useState('');
  const { selectedText, currentPage } = useViewerStore(useShallow(state => ({
    selectedText: state.selectedText,
    currentPage: state.currentPage,
  })));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Quick actions — context-aware chips above the composer
  const hasSelection = Boolean(selectedText);
  const quickActions: Array<{ label: string; prompt: string; testId: string }> = [];
  if (hasSelection) {
    quickActions.push({ label: 'Explain', prompt: `Explain this selected text in simple terms.`, testId: 'chat-quick-explain' });
    quickActions.push({ label: 'Summarize', prompt: `Summarize the selected text in one or two sentences.`, testId: 'chat-quick-summarize' });
    quickActions.push({ label: 'Simplify', prompt: `Re-explain the selected text as if I were a beginner.`, testId: 'chat-quick-simplify' });
  } else {
    quickActions.push({ label: 'Summarize page', prompt: `Summarize the current page of the document.`, testId: 'chat-quick-page' });
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-background">
      {/* Quick actions — context-aware */}
      {quickActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickActions.map((qa) => (
            <button
              key={qa.testId}
              type="button"
              disabled={disabled}
              onClick={() => onSend(qa.prompt)}
              className="px-2.5 py-1 text-xs rounded-full border border-white/10 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors disabled:opacity-50"
              data-testid={qa.testId}
            >
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {hasSelection && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20 text-xs" data-testid="chat-selection-context">
          <p className="text-accent font-medium mb-0.5">Selection (page {currentPage})</p>
          <p className="text-muted-foreground line-clamp-2 italic">"{selectedText}"</p>
        </div>
      )}

      <div className="relative flex items-end">
        <textarea
          data-testid="chat-input"
          className="w-full min-h-[44px] max-h-32 resize-none rounded-xl border border-input bg-transparent px-3 py-2 pr-10 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={hasSelection ? 'Ask about the selected text...' : 'Ask a question...'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        {isGenerating && onStop ? (
          <Button
            type="button"
            size="icon"
            onClick={onStop}
            className="absolute right-1 bottom-1 h-8 w-8 rounded-lg"
            title="Stop generating"
            data-testid="chat-stop"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!value.trim() || disabled}
            className="absolute right-1 bottom-1 h-8 w-8 rounded-lg"
            data-testid="chat-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
};
