import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useChatStore } from '../../stores/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { AIGateway } from '../../lib/providers/AIGateway';

export const ChatSidebar = () => {
  const { 
    isChatOpen, 
    messages, 
    isGenerating, 
    setChatOpen, 
    addMessage, 
    appendStreamChunk, 
    setIsGenerating 
  } = useChatStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isChatOpen) return null;

  const handleSend = async (text: string) => {
    const userMessageId = crypto.randomUUID();
    addMessage({
      id: userMessageId,
      role: 'user',
      content: text,
      createdAt: Date.now()
    });

    const assistantMessageId = crypto.randomUUID();
    addMessage({
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now()
    });

    setIsGenerating(true);

    try {
      await AIGateway.generateStream(text, undefined, (chunk) => {
        appendStreamChunk(assistantMessageId, chunk);
      });
    } catch (error) {
      console.error(error);
      appendStreamChunk(assistantMessageId, "\n\n*(Error generating response)*");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col h-full shrink-0" data-testid="chat-sidebar">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-muted/10">
        <h3 className="font-semibold text-sm">Chat</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChatOpen(false)} data-testid="chat-close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-2">Ask a question about the document.</p>
          </div>
        ) : (
          <div className="flex flex-col pb-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0">
        <ChatInput onSend={handleSend} disabled={isGenerating} />
      </div>
    </div>
  );
};
