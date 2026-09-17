import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Lock, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useChatStore } from '../../stores/chatStore';
import { useBillingStore } from '../../stores/billingStore';
import { useViewerStore } from '../../stores/viewerStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { KnowledgeSearch } from './KnowledgeSearch';
import { useUiStore } from '../../stores/uiStore';
import { useShallow } from 'zustand/react/shallow';
import { fetchAiConfig, type CatalogModelUI, FREE_LIMIT } from '../../lib/modelCatalog';
import { useEffect, useMemo, useState } from 'react';

function ModelSelectorPanel({ selectedModel, onChange, plan }: { selectedModel: string; onChange: (m: string) => void; plan: string }) {
  const [catalog, setCatalog] = useState<CatalogModelUI[] | null>(null)
  const [quota, setQuota] = useState<{ used: number; limit: number; resets_at: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    const wsId = (useViewerStore.getState().activeWorkspace?.id || useWorkspaceStore.getState().activeWorkspace?.id || '')
    fetchAiConfig(wsId).then((cfg) => { if (!cancelled) { setCatalog(cfg.models); setQuota(cfg.quota); } })
    return () => { cancelled = true }
  }, [])
  const freeList = catalog?.filter((m) => m.tier === 'free') ?? []
  const proList = catalog?.filter((m) => m.tier === 'pro') ?? []
  const display = (list: CatalogModelUI[]) =>
    list.map((m) => (
      <button
        key={m.model_id}
        disabled={plan === 'free' && m.tier === 'pro'}
        onClick={() => onChange(m.model_id)}
        title={m.display_name + (m.tier === 'pro' ? ' (Pro)' : ' (Free)')}
        className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-all ${
          selectedModel === m.model_id
            ? 'border-accent/50 bg-accent/10 text-accent font-medium'
            : m.tier === 'pro' && plan === 'free'
            ? 'border-white/5 bg-secondary/10 text-muted-foreground/40 cursor-not-allowed'
            : 'border-white/5 bg-secondary/20 text-muted-foreground hover:text-foreground hover:border-white/20'
        }`}
      >
        <span className="flex items-center gap-1.5">{m.display_name}</span>
        {m.tier === 'free' ? <span className="text-[10px] font-semibold text-emerald-400">FREE</span> : <span className="flex items-center gap-1 text-[10px] text-accent/70 font-semibold"><Lock className="w-3 h-3" /> Pro</span>}
      </button>
    ))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gratuito</p>
        {display(freeList)}
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Pro</p>
        {display(proList)}
      </div>
      {quota ? (
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{quota.used} / {quota.limit} AI requests today · resets {new Date(quota.resets_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} UTC</p>
      ) : null}
    </div>
  )
}

export const ChatSidebar = () => {
  const { setActiveRightPanel } = useUiStore();
  const navigate = useNavigate();
  const setCurrentPage = useViewerStore(state => state.setCurrentPage);
  const currentDocumentId = useViewerStore(state => state.documentId);

  const navigateToCitationPage = (pageNumber: number) => {
    if (pageNumber && pageNumber > 0) {
      setCurrentPage(pageNumber);
      setActiveRightPanel(null);
    }
  };

  const openCitationDocument = (documentId: string) => {
    if (documentId !== currentDocumentId) {
      navigate(`/viewer/${documentId}`);
    } else {
      setActiveRightPanel(null);
    }
  };
  const {
    isGenerating,
    isLoadingSession,
    selectedModel,
    setSelectedModel,
    sendMessage,
    stopGenerating,
    getActiveMessages,
  } = useChatStore(useShallow(state => ({
    isGenerating: state.isGenerating,
    isLoadingSession: state.isLoadingSession,
    selectedModel: state.selectedModel,
    setSelectedModel: state.setSelectedModel,
    sendMessage: state.sendMessage,
    stopGenerating: state.stopGenerating,
    getActiveMessages: state.getActiveMessages,
  })));

  const { subscription } = useBillingStore(useShallow(state => ({ subscription: state.subscription })));
  const currentPlan = (subscription?.plan?.code || 'free') as PlanType;
  const planConfig = PLANS[currentPlan] ?? PLANS.free!;

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
    // Client guard: free plan cannot pick pro-tier models (mirrors server tierOf).
    const isPro = modelCode === 'gemini-3.6-flash' || modelCode === 'gemini-3.6-pro'
    if (currentPlan === 'free' && isPro) return;
    setSelectedModel(modelCode);
    try { localStorage.setItem('lumena.chat.model', modelCode) } catch { /* ignore */ }
  };

  const [showSearch, setShowSearch] = useState(false);

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

        {/* Plan-aware Catalog Model Selector */}
        <ModelSelectorPanel
          selectedModel={selectedModel}
          onChange={handleModelChange}
          plan={currentPlan}
        />
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{currentPlan === 'free' ? 'Upgrade to Pro to unlock advanced models.' : 'Pro plan active — all models available.'}</p>

          {/* Knowledge Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center justify-between text-xs px-3 py-2 rounded-lg border border-white/5 bg-secondary/10 text-muted-foreground hover:text-foreground hover:border-white/10 hover:bg-secondary/20 transition-colors w-full"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              <span>Search Knowledge</span>
            </div>
            {showSearch ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showSearch && (
            <div className="pt-2 border-t border-white/5">
              <KnowledgeSearch
                onSelectResult={(result) => {
                  if (result.document_id === currentDocumentId && result.page_number) {
                    setCurrentPage(result.page_number);
                  } else if (result.document_id) {
                    navigate(`/viewer/${result.document_id}`);
                  }
                }}
              />
            </div>
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
              <ChatMessage
                key={msg.id}
                message={msg}
                onNavigateToPage={navigateToCitationPage}
                onOpenDocument={openCitationDocument}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0">
        <ChatInput onSend={handleSend} onStop={stopGenerating} disabled={isLoadingSession} isGenerating={isGenerating} />
      </div>
    </div>
  );
};

