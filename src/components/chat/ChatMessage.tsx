import { User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage as IChatMessage } from '../../types/chat';
import { cn } from '../../lib/utils';
import { Citations } from './Citations';

interface ChatMessageProps {
  message: IChatMessage;
  onNavigateToPage?: (pageNumber: number) => void;
  onOpenDocument?: (documentId: string) => void;
}

export const ChatMessage = ({ message, onNavigateToPage, onOpenDocument }: ChatMessageProps) => {
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
        {/* Markdown rendered safely (no raw HTML) */}
        <div className="prose prose-sm dark:prose-invert break-words max-w-none [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-secondary/40 [&_pre]:p-3 [&_code]:text-xs [&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1">
          <ReactMarkdown
            components={{
              // Links open safely in new tabs
              a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
            }}
          >
            {message.content || (message.role === 'assistant' ? '…' : '')}
          </ReactMarkdown>
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
        {message.citations && message.citations.length > 0 && (
          <Citations
            citations={message.citations}
            onNavigateToPage={onNavigateToPage}
            onOpenDocument={onOpenDocument}
          />
        )}
      </div>
    </div>
  );
};
