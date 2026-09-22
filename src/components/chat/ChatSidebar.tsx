import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Sparkles, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useChatStore } from '../../stores/chatStore';
import { useBillingStore } from '../../stores/billingStore';
import { useViewerStore } from '../../stores/viewerStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ModelSelectorPanel } from './ModelSelectorPanel';
import { KnowledgeSearch } from './KnowledgeSearch';
import { useUiStore } from '../../stores/uiStore';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from '../../lib/supabase';
import { resolveChatLanguage } from '../../lib/chatLanguage';

interface ChatSidebarProps {
  fileUrl?: string;
  documentId?: string;
  workspaceId?: string;
}

export const ChatSidebar = ({ fileUrl, documentId, workspaceId }: ChatSidebarProps) => {
  const { setActiveRightPanel } = useUiStore();
  const navigate = useNavigate();
  const {
    setCurrentPage,
    currentDocumentId,
    currentPage,
    selectedText,
    pageLabels,
  } = useViewerStore(useShallow((state) => ({
    setCurrentPage: state.setCurrentPage,
    currentDocumentId: state.documentId,
    currentPage: state.currentPage,
    selectedText: state.selectedText,
    pageLabels: state.pageLabels,
  })));

  const navigateToCitationPage = (pageNumber: number) => {
    if (pageNumber && pageNumber > 0) {
      setCurrentPage(pageNumber);
      setActiveRightPanel(null);
    }
  };

  const openCitationDocument = (targetDocumentId: string) => {
    if (targetDocumentId !== currentDocumentId) {
      navigate(`/viewer/${targetDocumentId}`);
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
  } = useChatStore(useShallow((state) => ({
    isGenerating: state.isGenerating,
    isLoadingSession: state.isLoadingSession,
    selectedModel: state.selectedModel,
    setSelectedModel: state.setSelectedModel,
    sendMessage: state.sendMessage,
    stopGenerating: state.stopGenerating,
    getActiveMessages: state.getActiveMessages,
  })));

  const { subscription } = useBillingStore(useShallow((state) => ({ subscription: state.subscription })));
  const currentPlan = subscription?.plan?.code === 'pro' ? 'pro' : 'free';

  const messages = getActiveMessages();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [currentPageText, setCurrentPageText] = useState('');
  const [documentLanguageSample, setDocumentLanguageSample] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const id = currentDocumentId ?? documentId;
    if (!id || !currentPage) {
      setCurrentPageText('');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from('document_page_texts')
          .select('page_text')
          .eq('document_id', id)
          .eq('page_number', currentPage)
          .maybeSingle();
        if (!cancelled) setCurrentPageText(data?.page_text ?? '');
      } catch {
        if (!cancelled) setCurrentPageText('');
      }
    })();

    return () => { cancelled = true; };
  }, [currentDocumentId, documentId, currentPage]);

  useEffect(() => {
    const id = currentDocumentId ?? documentId;
    if (!id) {
      setDocumentLanguageSample('');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from('document_page_texts')
          .select('page_text')
          .eq('document_id', id)
          .order('page_number', { ascending: true })
          .limit(3);
        if (!cancelled) {
          setDocumentLanguageSample((data ?? []).map((row) => row.page_text ?? '').join('\n').slice(0, 6000));
        }
      } catch {
        if (!cancelled) setDocumentLanguageSample('');
      }
    })();

    return () => { cancelled = true; };
  }, [currentDocumentId, documentId]);

  const language = useMemo(() => resolveChatLanguage({
    recentUserMessages: messages.filter((m) => m.role === 'user').slice(-4).map((m) => m.content),
    currentPageText: currentPageText || selectedText,
    documentText: documentLanguageSample,
    locale: typeof navigator !== 'undefined' ? navigator.language : 'en',
  }), [messages, currentPageText, selectedText, documentLanguageSample]);

  const handleSend = async (text: string) => {
    await sendMessage(text, {
      fileUrl,
      documentId: currentDocumentId ?? documentId,
      workspaceId,
      currentPage,
    });
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

        <ModelSelectorPanel
          selectedModel={selectedModel}
          onChange={setSelectedModel}
          plan={currentPlan}
          capability="chat"
          disabled={isGenerating || isLoadingSession}
          workspaceId={workspaceId}
        />

        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center justify-between text-xs px-3 py-2 rounded-lg border border-white/5 bg-secondary/10 text-muted-foreground hover:text-foreground hover:border-white/10 hover:bg-secondary/20 transition-colors w-full"
          type="button"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Buscar conocimiento</span>
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

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {isLoadingSession ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
            <p className="text-sm">Cargando conversación...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
            <p className="text-sm">No hay mensajes aún.</p>
            <p className="text-xs mt-2">Hacé una pregunta sobre el documento.</p>
          </div>
        ) : (
          <div className="flex flex-col pb-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onNavigateToPage={navigateToCitationPage}
                onOpenDocument={openCitationDocument}
                getPageLabel={(pageNumber) => pageLabels[pageNumber - 1] ?? String(pageNumber)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0">
        <ChatInput
          onSend={handleSend}
          onStop={stopGenerating}
          disabled={isLoadingSession}
          isGenerating={isGenerating}
          language={language}
        />
      </div>
    </div>
  );
};
