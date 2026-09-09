import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { useViewerStore } from '../../stores/viewerStore';
import { usePageRegistryStore } from '../../stores/pageRegistryStore';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import {
  X, ChevronLeft, ChevronRight, RotateCcw,
  BookOpen, MessageSquare, Layers, Brain,
  Search, Loader2, Sparkles, ArrowLeft, ArrowRight,
  Settings, Volume2, VolumeX, Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Flashcard, GlossaryTerm, TimelineEvent, Topic, Concept } from '../../types/knowledge';
import { SRSReview } from './SRSReview';

interface StudyModeOverlayProps {
  documentId: string;
}

type StudyMode = 'reading' | 'qa' | 'flashcard' | 'srs' | 'context';

interface QAMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    document_id: string;
    document_name: string;
    page_number: number;
    chunk_text: string;
    similarity: number;
  }>;
  timestamp: Date;
}

interface ContextPanelData {
  flashcards: Flashcard[];
  glossary: GlossaryTerm[];
  timeline: TimelineEvent[];
  topics: Topic[];
  concepts: Concept[];
}

export const StudyModeOverlay = ({ documentId }: StudyModeOverlayProps) => {
  const {
    flashcards,
    glossary,
    timelineEvents,
    topics,
    concepts,
    setStudyMode,
  } = useKnowledgeStore();

  const {
    currentPage,
    totalPages,
    setCurrentPage,
    selectedText,
    selectedTextPageIndex,
  } = useViewerStore();

  const { pages } = usePageRegistryStore.getState();

  const [mode, setMode] = useState<StudyMode>('reading');
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [qaMessages, setQAMessages] = useState<QAMessage[]>([]);
  const [qaInput, setQAInput] = useState('');
  const [isQALoading, setIsQALoading] = useState(false);
  const [_contextData, setContextData] = useState<ContextPanelData>({
    flashcards: [],
    glossary: [],
    timeline: [],
    topics: [],
    concepts: [],
  });
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [ttsPlaying, setTTSPlaying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [showSRSReview, setShowSRSReview] = useState(false);

  const docFlashcards = useMemo(() => flashcards[documentId] || [], [flashcards, documentId]);
  const docGlossary = useMemo(() => glossary[documentId] || [], [glossary, documentId]);
  const docTimeline = useMemo(() => timelineEvents[documentId] || [], [timelineEvents, documentId]);
  const docTopics = useMemo(() => topics[documentId] || [], [topics, documentId]);
  const docConcepts = useMemo(() => concepts[documentId] || [], [concepts, documentId]);

const currentPageData = pages[currentPage - 1];
  const ocrText = currentPageData?.ocrData?.data?.text || '';

  const docTopicsSorted = [...docTopics].sort((a, b) => a.order_index - b.order_index);
  const currentTopic = docTopicsSorted.find(t =>
    currentPage >= t.page_range.start && currentPage <= t.page_range.end
  );


  const docFlashcardsRef = useRef(docFlashcards);
  const docGlossaryRef = useRef(docGlossary);
  const docTimelineRef = useRef(docTimeline);
  const docTopicsRef = useRef(docTopics);
  const docConceptsRef = useRef(docConcepts);

  // Update refs when data changes
  useEffect(() => { docFlashcardsRef.current = docFlashcards; }, [docFlashcards]);
  useEffect(() => { docGlossaryRef.current = docGlossary; }, [docGlossary]);
  useEffect(() => { docTimelineRef.current = docTimeline; }, [docTimeline]);
  useEffect(() => { docTopicsRef.current = docTopics; }, [docTopics]);
  useEffect(() => { docConceptsRef.current = docConcepts; }, [docConcepts]);

  useEffect(() => {
    if (documentId) {
      setContextData({
        flashcards: docFlashcardsRef.current,
        glossary: docGlossaryRef.current,
        timeline: docTimelineRef.current,
        topics: docTopicsRef.current,
        concepts: docConceptsRef.current,
      });
    }
  }, [documentId]);

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  }, [currentPage, totalPages, setCurrentPage]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  }, [currentPage, setCurrentPage]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  }, [totalPages, setCurrentPage]);

  const handleNextFlashcard = useCallback(() => {
    setIsFlipped(false);
    setCurrentFlashcardIndex(prev => Math.min(prev + 1, docFlashcardsRef.current.length - 1));
  }, []);

  const handlePrevFlashcard = useCallback(() => {
    setIsFlipped(false);
    setCurrentFlashcardIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const handleFlipFlashcard = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  const handleQASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim() || isQALoading) return;

    const userMessage = qaInput.trim();
    setQAInput('');
    setIsQALoading(true);

    const newUserMessage: QAMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setQAMessages(prev => [...prev, newUserMessage]);

    try {
      const contextChunks = [
        ocrText.substring(0, 3000),
        ...docGlossary.map((g: GlossaryTerm) => `${g.term}: ${g.definition}`),
        ...docFlashcards.map((f: Flashcard) => `Q: ${f.front} A: ${f.back}`),
        ...docTimeline.map((t: TimelineEvent) => `${t.date_str}: ${t.description}`),
      ].filter(Boolean).join('\n\n');

      const systemPrompt = `You are a helpful study assistant. Answer questions based on the provided document context.

Document Context:
${contextChunks}

Instructions:
- Answer based on the document context provided
- If the answer isn't in the context, say so
- Cite specific parts of the document when possible
- Be concise but comprehensive`;

      const session = await supabase.auth.getSession();
      const { data: { session: currentSession } } = session;

      if (!currentSession) throw new Error('No active session');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          prompt: userMessage,
          workspace_id: (await supabase.auth.getUser()).data.user?.id,
          action_type: 'chat',
          model_code: 'gemini-flash-latest',
          document_id: documentId,
          context: { systemPrompt, ragChunks: [] },
          stream: false,
        }),
      });

      if (!response.ok) throw new Error('Failed to get answer');

      const data = await response.json();
      const assistantMessage: QAMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text,
        citations: data.citations,
        timestamp: new Date(),
      };
      setQAMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Q&A error:', err);
      const errorMessage: QAMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, I couldn't generate an answer. Please try again.",
        timestamp: new Date(),
      };
      setQAMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsQALoading(false);
    }
  };

  const handleTTS = useCallback(() => {
    if (ttsPlaying) {
      window.speechSynthesis.cancel();
      setTTSPlaying(false);
    } else if (ocrText) {
      const utterance = new SpeechSynthesisUtterance(ocrText);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => setTTSPlaying(false);
      utterance.onerror = () => setTTSPlaying(false);
      setTTSPlaying(true);
      window.speechSynthesis.speak(utterance);
    }
  }, [ttsPlaying, ocrText]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (mode) {
        case 'reading':
          if (e.key === 'ArrowRight' || e.key === ' ') goToNextPage();
          if (e.key === 'ArrowLeft') goToPrevPage();
          if (e.key === 't') handleTTS();
          if (e.key === 'q') setMode('qa');
          if (e.key === 'f') setMode('flashcard');
          if (e.key === 's') setMode('srs');
          if (e.key === 'c') setShowContextPanel(true);
          break;
        case 'flashcard':
          if (e.key === ' ') handleFlipFlashcard();
          if (e.key === 'ArrowRight') handleNextFlashcard();
          if (e.key === 'ArrowLeft') handlePrevFlashcard();
          if (e.key === 'r') setMode('reading');
          if (e.key === 'q') setMode('qa');
          break;
        case 'qa':
          if (e.key === 'Escape') setMode('reading');
          break;
        case 'srs':
          if (e.key === 'Escape') setMode('reading');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, currentPage, totalPages, goToNextPage, goToPrevPage, handleTTS, handleFlipFlashcard, handleNextFlashcard, handlePrevFlashcard]);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  const goToTopic = (topic: Topic) => {
    goToPage(topic.page_range.start);
  };

  const goToNextTopic = () => {
    const currentIndex = docTopicsSorted.findIndex(t => t.id === currentTopic?.id);
    if (currentIndex !== -1 && currentIndex < docTopicsSorted.length - 1) {
      goToTopic(docTopicsSorted[currentIndex + 1]);
    }
  };

  const goToPrevTopic = () => {
    const currentIndex = docTopicsSorted.findIndex(t => t.id === currentTopic?.id);
    if (currentIndex > 0) {
      goToTopic(docTopicsSorted[currentIndex - 1]);
    }
  };

  if (!documentId) return null;

  if (showSRSReview) {
    return (
      <SRSReview
        documentIds={[documentId]}
        onClose={() => setShowSRSReview(false)}
      />
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col",
        theme === 'dark' && 'bg-gray-950',
        theme === 'sepia' && 'bg-amber-50'
      )}
      data-testid="study-mode-overlay"
      style={{
        fontSize: `${fontSize}px`,
        backgroundColor: theme === 'sepia' ? '#fef9e7' : undefined,
        color: theme === 'dark' ? '#f1f5f9' : theme === 'sepia' ? '#43301e' : undefined,
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10"
            onClick={() => setStudyMode(false)}
            data-testid="close-study-mode-btn"
            aria-label="Close study mode"
          >
            <X className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <h2 className="font-heading font-semibold tracking-tight text-lg">Study Mode</h2>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {([
            { id: 'reading', label: 'Read', icon: BookOpen },
            { id: 'qa', label: 'Ask', icon: MessageSquare },
            { id: 'flashcard', label: 'Cards', icon: Layers },
            { id: 'srs', label: 'Review', icon: Zap },
            { id: 'context', label: 'Context', icon: Brain },
          ] as const).map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={mode === id ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all",
                mode === id ? "bg-accent text-accent-foreground shadow-sm" : "hover:bg-white/5"
              )}
              onClick={() => setMode(id as StudyMode)}
              data-testid={`mode-tab-${id}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {mode === 'reading' && ocrText && (
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-10 h-10 rounded-full", ttsPlaying && "bg-accent/20 text-accent")}
              onClick={handleTTS}
              aria-label={ttsPlaying ? 'Stop reading' : 'Read aloud'}
              data-testid="tts-btn"
            >
              {ttsPlaying ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>

          <Button
            variant={showContextPanel ? 'default' : 'ghost'}
            size="sm"
            className="w-10 h-10 rounded-full"
            onClick={() => setShowContextPanel(!showContextPanel)}
            aria-label="Toggle context panel"
            data-testid="context-panel-toggle"
          >
            <Layers className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10"
            onClick={() => setStudyMode(false)}
            aria-label="Close study mode"
          >
            <X className="w-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Navigation/Context */}
        <aside
          className={cn(
            "w-64 shrink-0 border-r border-white/10 bg-background/50 backdrop-blur-sm flex flex-col overflow-y-auto",
            showContextPanel && "w-80"
          )}
        >
          <nav className="p-4 border-b border-white/10 flex flex-col flex-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Navigate</h3>

            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="w-10 h-10"
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <input
                type="number"
                value={currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                min={1}
                max={totalPages}
                className="flex-1 text-center bg-white/5 border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Go to page"
              />
              <span className="text-sm text-muted-foreground w-10 text-right">/ {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                className="w-10 h-10"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {docTopicsSorted.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Topics</h4>
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {docTopicsSorted.map((topic) => (
                    <li key={topic.id}>
                      <button
                        onClick={() => goToTopic(topic)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                          currentTopic?.id === topic.id
                            ? "bg-accent/20 text-accent font-medium"
                            : "hover:bg-white/5 text-foreground/80"
                        )}
                        data-testid={`topic-${topic.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{topic.title}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">
                            pp. {topic.page_range.start}–{topic.page_range.end}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setMode('flashcard')}
                disabled={docFlashcards.length === 0}
              >
                <Layers className="w-4 h-4" /> Practice Flashcards
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setMode('qa')}
              >
                <MessageSquare className="w-4 h-4" /> Ask a Question
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setShowSRSReview(true)}
                disabled={!flashcards[documentId]?.some(f => !f.next_review_at || new Date(f.next_review_at!) <= new Date())}
              >
                <Zap className="w-4 h-4" /> SRS Review
              </Button>
            </div>
          </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {mode === 'reading' && (
            <ReadingMode
              documentId={documentId}
              currentPage={currentPage}
              totalPages={totalPages}
              ocrText={ocrText}
              selectedText={selectedText}
              selectedTextPageIndex={selectedTextPageIndex}
              onPageChange={goToPage}
              onPageNext={goToNextPage}
              onPagePrev={goToPrevPage}
              onTTS={handleTTS}
              ttsPlaying={ttsPlaying}
              fontSize={fontSize}
              theme={theme}
              setFontSize={setFontSize}
              setTheme={setTheme}
              currentTopic={currentTopic}
              goToNextTopic={goToNextTopic}
              goToPrevTopic={goToPrevTopic}
              docTopics={docTopicsSorted}
            />
          )}

          {mode === 'qa' && (
            <QAMode
              documentId={documentId}
              messages={qaMessages}
              qaInput={qaInput}
              setQAInput={setQAInput}
              onSubmit={handleQASubmit}
              isLoading={isQALoading}
              docFlashcards={docFlashcards}
              docGlossary={docGlossary}
              docTimeline={docTimeline}
              ocrText={ocrText}
            />
          )}

          {mode === 'flashcard' && (
            <FlashcardMode
              documentId={documentId}
              flashcards={docFlashcards}
              currentIndex={currentFlashcardIndex}
              isFlipped={isFlipped}
              onFlip={handleFlipFlashcard}
              onNext={handleNextFlashcard}
              onPrev={handlePrevFlashcard}
              onClose={() => setStudyMode(false)}
              totalCards={docFlashcards.length}
            />
          )}

          {mode === 'srs' && (
            <SRSReview
              documentIds={[documentId]}
              onClose={() => setMode('reading')}
            />
          )}

          {mode === 'context' && (
            <ContextMode
              _documentId={documentId}
              contextData={{
                flashcards: docFlashcards,
                glossary: docGlossary,
                timeline: docTimeline,
                topics: docTopics,
                concepts: docConcepts,
              }}
              onClose={() => setShowContextPanel(false)}
            />
          )}
        </main>

        {showContextPanel && (
          <aside className="w-80 shrink-0 border-l border-white/10 bg-background/50 backdrop-blur-sm flex flex-col">
            <ContextPanel
              contextData={{
                flashcards: docFlashcards,
                glossary: docGlossary,
                timeline: docTimeline,
                topics: docTopics,
                concepts: docConcepts,
              }}
              onClose={() => setShowContextPanel(false)}
              documentId={documentId}
            />
          </aside>
        )}
      </div>

      {settingsOpen && (
        <SettingsModal
          fontSize={fontSize}
          setFontSize={setFontSize}
          theme={theme}
          setTheme={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
};

// ==========================================
// Reading Mode Component
// ==========================================
interface ReadingModeProps {
  documentId: string;
  currentPage: number;
  totalPages: number;
  ocrText: string;
  selectedText: string;
  selectedTextPageIndex: number;
  onPageChange: (page: number) => void;
  onPageNext: () => void;
  onPagePrev: () => void;
  onTTS: () => void;
  ttsPlaying: boolean;
  fontSize: number;
  theme: 'light' | 'dark' | 'sepia';
  setFontSize: (size: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'sepia') => void;
  currentTopic: Topic | undefined;
  goToNextTopic: () => void;
  goToPrevTopic: () => void;
  docTopics: Topic[];
}

function ReadingMode(props: ReadingModeProps) {
  const { ocrText, currentPage, totalPages, fontSize, theme, ttsPlaying, currentTopic, docTopics } = props;
  const [showHighlights, setShowHighlights] = useState(true);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground px-2 py-1 rounded bg-white/5">
              Page {currentPage} / {totalPages}
            </span>
            {currentTopic && (
              <span className="text-xs px-2 py-1 rounded bg-accent/20 text-accent font-medium">
                {currentTopic.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {docTopics.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8"
                  onClick={props.goToPrevTopic}
                  disabled={!currentTopic || docTopics[0]?.id === currentTopic.id}
                  aria-label="Previous topic"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8"
                  onClick={props.goToNextTopic}
                  disabled={!currentTopic || docTopics[docTopics.length - 1]?.id === currentTopic.id}
                  aria-label="Next topic"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 px-4 py-2 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Size</span>
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8"
              onClick={() => props.setFontSize(Math.max(12, fontSize - 2))}
              aria-label="Decrease font size"
            >
              <span className="text-xs">-A</span>
            </Button>
            <span className="text-sm font-mono w-10 text-center">{fontSize}px</span>
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8"
              onClick={() => props.setFontSize(Math.min(24, fontSize + 2))}
              aria-label="Increase font size"
            >
              <span className="text-xs">+A</span>
            </Button>
          </div>

          <div className="flex items-center gap-1 mx-4">
            {(['light', 'dark', 'sepia'] as const).map(t => (
              <Button
                key={t}
                variant={theme === t ? 'default' : 'ghost'}
                size="sm"
                className="w-8 h-8 rounded"
                onClick={() => props.setTheme(t)}
                aria-label={`${t} theme`}
                aria-pressed={theme === t}
              >
                {t === 'light' && <span className="text-xs">☀</span>}
                {t === 'dark' && <span className="text-xs">🌙</span>}
                {t === 'sepia' && <span className="text-xs">📄</span>}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showHighlights}
                onChange={(e) => setShowHighlights(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 accent-accent"
              />
              Highlights
            </label>
            <Button
              variant={ttsPlaying ? 'default' : 'outline'}
              size="sm"
              className="gap-1"
              onClick={props.onTTS}
              aria-label={ttsPlaying ? 'Stop reading' : 'Read aloud'}
            >
              {ttsPlaying ? <span className="text-xs">⏹ Stop</span> : <span className="text-xs">🔊 Read</span>}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6" style={{ fontSize: `${fontSize}px` }}>
          <div className="max-w-3xl mx-auto space-y-6">
            {ocrText ? (
              <div
                className={cn(
                  "prose prose-lg max-w-none",
                  theme === 'dark' && 'prose-invert',
                  theme === 'sepia' && 'prose-sepia'
                )}
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
              >
                {ocrText.split('\n\n').map((paragraph, i) => (
                  <p key={i} className="leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <Search className="w-8 h-8" />
                </div>
                <p className="text-lg font-medium mb-2">No text extracted yet</p>
                <p className="text-sm">OCR processing may still be running for this page.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Q&A Mode Component
// ==========================================
interface QAModeProps {
  documentId: string;
  messages: QAMessage[];
  qaInput: string;
  setQAInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  docFlashcards: Flashcard[];
  docGlossary: GlossaryTerm[];
  docTimeline: TimelineEvent[];
  ocrText: string;
}

function QAMode(props: QAModeProps) {
  const { messages, qaInput, setQAInput, onSubmit, isLoading, docFlashcards, docGlossary, docTimeline, ocrText } = props;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Document Context
          </span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> {ocrText ? 'OCR' : 'No OCR'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> {docFlashcards.length} Cards
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> {docGlossary.length} Terms
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> {docTimeline.length} Events
            </span>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 px-4">
          {[
            "Summarize this document",
            "What are the key concepts?",
            "Explain the main arguments",
            "What are the important dates?",
            "Create a study guide",
            "Quiz me on this content"
          ].map(q => (
            <Button
              key={q}
              variant="outline"
              size="sm"
              className="whitespace-nowrap hover:bg-accent/10"
              onClick={() => {
                setQAInput(q);
                textareaRef.current?.focus();
              }}
            >
              {q}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p className="text-sm max-w-xs">Ask questions about the document, request summaries, or get explanations of key concepts.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <QAMessageBubble key={msg.id} message={msg} />
          ))
        )}

        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={props.onSubmit} className="p-4 border-t border-white/10 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={qaInput}
            onChange={(e) => setQAInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the document... (Shift+Enter for new line)"
            className="flex-1 min-h-[48px] max-h-48 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
            disabled={isLoading}
            rows={1}
          />
          <Button
            type="submit"
            disabled={!qaInput.trim() || isLoading}
            size="lg"
            className="h-12 w-12 rounded-xl flex-shrink-0"
            aria-label="Send question"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}

// ==========================================
// QA Message Bubble
// ==========================================
function QAMessageBubble({ message }: { message: QAMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex gap-3 px-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow",
        isUser ? "bg-background" : "bg-primary text-primary-foreground"
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-2">
        <div className="prose prose-sm dark:prose-invert break-words">
          {message.content}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.citations.map((ref, idx) => (
              <span key={idx} className="inline-flex items-center rounded-md bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground ring-1 ring-inset ring-accent/20">
                [{idx + 1}] {ref.document_name}, p.{ref.page_number} ({(ref.similarity * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
        )}
        <div className="text-xs text-muted-foreground/50">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Flashcard Mode Component
// ==========================================
interface FlashcardModeProps {
  documentId: string;
  flashcards: Flashcard[];
  currentIndex: number;
  isFlipped: boolean;
  onFlip: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  totalCards: number;
}

function FlashcardMode(props: FlashcardModeProps) {
  const { flashcards, currentIndex, isFlipped, onFlip, onNext, onPrev, totalCards } = props;
  const currentCard = flashcards[currentIndex];

  if (!currentCard) return null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative w-full h-full overflow-y-auto" data-testid="flashcard-mode-view">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-heading font-bold mb-2">Flashcards</h2>
        <p className="text-muted-foreground">Card {currentIndex + 1} of {totalCards}</p>
      </div>

      <div
        className="relative w-full max-w-2xl aspect-[3/2] cursor-pointer group perspective-1000"
        onClick={onFlip}
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
            {currentCard.page_number && (
              <div className="mt-4 text-sm text-accent/70">
                Page {currentCard.page_number}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 mt-12">
        <Button
          variant="outline"
          size="lg"
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="w-16 h-16 rounded-full p-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button
          variant="default"
          size="lg"
          onClick={onFlip}
          className="px-8 h-16 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-lg"
        >
          <RotateCcw className="w-5 h-5 mr-3" /> Flip Card
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={onNext}
          disabled={currentIndex === totalCards - 1}
          className="w-16 h-16 rounded-full p-0"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// Context Mode Component
// ==========================================
interface ContextModeProps {
  _documentId?: string;
  contextData: ContextPanelData;
  onClose: () => void;
}

function ContextMode({ contextData, onClose }: ContextModeProps) {
  const { flashcards, glossary, timeline, topics, concepts } = contextData;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <h2 className="font-heading font-semibold">Knowledge Context</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Flashcards */}
        {flashcards.length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Flashcards ({flashcards.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {flashcards.slice(0, 10).map((card) => (
                <div key={card.id} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                  <p className="font-medium text-sm">{card.front}</p>
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{card.back}</p>
                  {card.page_number && <span className="text-xs text-accent/70">Page {card.page_number}</span>}
                </div>
              ))}
              {flashcards.length > 10 && (
                <p className="text-xs text-muted-foreground">+ {flashcards.length - 10} more...</p>
              )}
            </div>
          </section>
        )}

        {/* Glossary */}
        {glossary.length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Glossary ({glossary.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {glossary.slice(0, 10).map((term) => (
                <div key={term.id} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                  <h4 className="font-medium text-accent mb-1">{term.term}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{term.definition}</p>
                </div>
              ))}
              {glossary.length > 10 && (
                <p className="text-xs text-muted-foreground">+ {glossary.length - 10} more...</p>
              )}
            </div>
          </section>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Timeline ({timeline.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {timeline.slice(0, 10).map((event) => (
                <div key={event.id} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-accent font-medium mb-1">
                    <span>{event.date_str}</span>
                    {event.page_number && (
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px]">
                        p.{event.page_number}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{event.description}</p>
                </div>
              ))}
              {timeline.length > 10 && (
                <p className="text-xs text-muted-foreground">+ {timeline.length - 10} more...</p>
              )}
            </div>
          </section>
        )}

        {/* Topics */}
        {topics.length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Topics ({topics.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {topics.slice(0, 10).map((topic) => (
                <div key={topic.id} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                  <h4 className="font-medium mb-1">{topic.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{topic.summary}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>pp. {topic.page_range.start}–{topic.page_range.end}</span>
                  </div>
                </div>
              ))}
              {topics.length > 10 && (
                <p className="text-xs text-muted-foreground">+ {topics.length - 10} more...</p>
              )}
            </div>
          </section>
        )}

        {/* Concepts */}
        {concepts.length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Concepts ({concepts.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {concepts.slice(0, 10).map((concept) => (
                <div key={concept.id} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium">{concept.name}</h4>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                      {Math.round(concept.importance * 100)}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{concept.definition}</p>
                </div>
              ))}
              {concepts.length > 10 && (
                <p className="text-xs text-muted-foreground">+ {concepts.length - 10} more...</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Context Panel (Right Sidebar)
// ==========================================
interface ContextPanelProps {
  contextData: ContextPanelData;
  onClose: () => void;
  documentId: string;
}

function ContextPanel({ contextData, onClose, documentId }: ContextPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <h2 className="font-heading font-semibold">Knowledge Context</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <ContextMode _documentId={documentId} contextData={contextData} onClose={onClose} />
      </div>
    </div>
  );
}

// ==========================================
// Settings Modal
// ==========================================
interface SettingsModalProps {
  fontSize: number;
  setFontSize: (size: number) => void;
  theme: 'light' | 'dark' | 'sepia';
  setTheme: (theme: 'light' | 'dark' | 'sepia') => void;
  onClose: () => void;
}

function SettingsModal({ fontSize, setFontSize, theme, setTheme, onClose }: SettingsModalProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading font-semibold text-lg">Settings</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Font Size</label>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setFontSize(Math.max(12, fontSize - 2))}>
                <span className="text-xs">-A</span>
              </Button>
              <span className="text-lg font-mono w-12 text-center">{fontSize}px</span>
              <Button variant="outline" size="sm" onClick={() => setFontSize(Math.min(24, fontSize + 2))}>
                <span className="text-xs">+A</span>
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="flex gap-2">
              {(['light', 'dark', 'sepia'] as const).map(t => (
                <Button
                  key={t}
                  variant={theme === t ? 'default' : 'outline'}
                  className="flex-1 py-3"
                  onClick={() => setTheme(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Button className="w-full mt-4" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

// Need to import User icon
import { User, Clock } from 'lucide-react';