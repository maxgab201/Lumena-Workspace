import { useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useChatStore } from '../../stores/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useUiStore } from '../../stores/uiStore';

export const ChatSidebar = () => {
  const { setActiveRightPanel } = useUiStore();
  const {
    isGenerating,
    isLoadingSession,
    selectedModel,
    setSelectedModel,
    sendMessage,
    getActiveMessages,
  } = useChatStore();

  const messages = getActiveMessages();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    await sendMessage(text);
  };

  return (
    <div
      className="flex flex-col h-full bg-background/60 backdrop-blur-3xl border-l border-white/10 w-80 shadow-2xl"
      data-testid="chat-sidebar"
    >
      <div className="flex flex-col p-4 border-b border-white/10 shrink-0 gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            Lumena AI
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0"
            onClick={() => setActiveRightPanel('none')}
            data-testid="chat-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <Select 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={isGenerating || isLoadingSession}
          className="h-8 text-xs bg-secondary/20 border-white/5"
        >
          <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
          <option value="gemini-1.5-pro">Gemini 1.5 Pro (Advanced)</option>
        </Select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {isLoadingSession ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
            <p className="text-sm">Loading conversation...</p>
          </div>
        ) : messages.length === 0 ? (
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
        <ChatInput onSend={handleSend} disabled={isGenerating || isLoadingSession} />
      </div>
    </div>
  );
};
