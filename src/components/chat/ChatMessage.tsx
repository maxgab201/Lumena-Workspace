import { User, Sparkles } from 'lucide-react';
import type { ChatMessage as IChatMessage } from '../../types/chat';
import { cn } from '../../lib/utils';

interface ChatMessageProps {
  message: IChatMessage;
}

export const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex gap-3 px-4 py-3 text-sm", isUser ? "" : "bg-muted/30")} data-testid={`chat-msg-${message.role}`}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow",
        isUser ? "bg-background" : "bg-primary text-primary-foreground"
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="prose prose-sm dark:prose-invert break-words">
          {message.content}
        </div>
        {message.references && message.references.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.references.map((ref, idx) => (
              <span key={idx} className="inline-flex items-center rounded-md bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground ring-1 ring-inset ring-accent/20">
                {ref.type === 'page' ? `Page ${ref.pageIndex}` : 'Highlight'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
