import { useEffect, useRef } from 'react';
import { X, Sparkles, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { useChatStore } from '../../stores/chatStore';
import { useBillingStore } from '../../stores/billingStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useUiStore } from '../../stores/uiStore';
import { AVAILABLE_MODELS, PLANS, type PlanType } from '../../types/billing';

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

  const { subscription } = useBillingStore();
  const currentPlan = (subscription?.plan?.code || 'free') as PlanType;
  const planConfig = PLANS[currentPlan] ?? PLANS.free;

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

  const handleModelChange = (modelCode: string) => {
    const model = AVAILABLE_MODELS.find(m => m.code === modelCode);
    if (!model) return;
    const isLocked = !planConfig.allowedModels.includes(modelCode);
    if (isLocked) return; // Silently ignore — button is disabled
    setSelectedModel(modelCode);
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

        {/* Plan-aware Model Selector */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-col gap-1">
            {AVAILABLE_MODELS.map((model) => {
              const isLocked = !planConfig.allowedModels.includes(model.code);
              const isActive = selectedModel === model.code;
              return (
                <button
                  key={model.code}
                  disabled={isLocked || isGenerating || isLoadingSession}
                  onClick={() => handleModelChange(model.code)}
                  className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-all ${
                    isActive
                      ? 'border-accent/50 bg-accent/10 text-accent font-medium'
                      : isLocked
                      ? 'border-white/5 bg-secondary/10 text-muted-foreground/40 cursor-not-allowed'
                      : 'border-white/5 bg-secondary/20 text-muted-foreground hover:text-foreground hover:border-white/20'
                  }`}
                >
                  <span>{model.name}</span>
                  {isLocked && (
                    <span className="flex items-center gap-1 text-[10px] text-accent/70 font-semibold">
                      <Lock className="w-3 h-3" /> Pro
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {currentPlan === 'free' && (
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              Upgrade to Pro to unlock advanced models.
            </p>
          )}
        </div>
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

