import { useState } from 'react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { useBillingStore } from '../../stores/billingStore';
import { Button } from '../ui/Button';
import { Sparkles, Loader2, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface PresentationViewProps {
  documentId: string;
  workspaceId: string;
}

export const PresentationView = ({ documentId, workspaceId }: PresentationViewProps) => {
  const { presentations, deletePresentation, generatePresentation, isGenerating } = useKnowledgeStore();
  const { fetchBillingData } = useBillingStore();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'presenter'>('grid');

  const docPresentations = presentations[documentId] || [];
  const latestPresentation = docPresentations[0];

  const slides = latestPresentation?.slides || [];
  const currentSlide = slides[currentSlideIndex];

  const handleGenerate = async () => {
    try {
      await generatePresentation(documentId, workspaceId);
      await fetchBillingData();
      toast.success('Presentation generated!', { description: 'AI has created slides from your document.' });
    } catch (err: any) {
      toast.error('Generation failed', { description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePresentation(id, documentId);
      toast.success('Presentation deleted');
    } catch (err: any) {
      toast.error('Failed to delete', { description: err.message });
    }
  };

  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlideIndex(index);
    }
  };

  const nextSlide = () => goToSlide(currentSlideIndex + 1);
  const prevSlide = () => goToSlide(currentSlideIndex - 1);

  const exportAsJSON = () => {
    if (!latestPresentation) return;
    const json = JSON.stringify(latestPresentation, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${latestPresentation.title.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsMarkdown = () => {
    if (!latestPresentation) return;
    let md = `# ${latestPresentation.title}\n\n`;
    md += `*Generated from document • ${slides.length} slides*\n\n---\n\n`;
    for (const slide of slides) {
      md += `## Slide ${slide.index}: ${slide.title}\n\n`;
      for (const bullet of slide.bullets) {
        md += `- ${bullet}\n`;
      }
      if (slide.speaker_note) {
        md += `\n> **Speaker Notes:** ${slide.speaker_note}\n`;
      }
      md += '\n---\n\n';
    }
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${latestPresentation.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (slides.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
          <FileText className="w-8 h-8 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold text-lg mb-1">Presentations</h3>
          <p className="text-sm text-muted-foreground">
            Generate an AI-powered presentation from your document.
          </p>
        </div>
        <Button
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={handleGenerate}
          disabled={isGenerating}
          data-testid="generate-presentation-btn"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {isGenerating ? 'Generating...' : 'Generate with AI'}
        </Button>
      </div>
    );
  }

  if (!latestPresentation) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{latestPresentation.title}</h3>
            <p className="text-xs text-muted-foreground">{slides.length} slides</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={exportAsJSON}
            className="text-xs"
            data-testid="export-json-btn"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportAsMarkdown}
            className="text-xs"
            data-testid="export-md-btn"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> MD
          </Button>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="px-4 py-2 border-b border-white/10 shrink-0">
        <div className="flex gap-1 bg-white/5 rounded-lg p-1 inline-flex">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="px-3 py-1.5 text-xs"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'presenter' ? 'default' : 'ghost'}
            size="sm"
            className="px-3 py-1.5 text-xs"
            onClick={() => setViewMode('presenter')}
          >
            Presenter
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'grid' ? (
          // Grid view - all slides as thumbnails
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {slides.map((slide, index) => (
              <button
                key={slide.index}
                onClick={() => { setCurrentSlideIndex(index); setViewMode('presenter'); }}
                className={`relative group p-4 rounded-xl border-2 transition-all hover:border-accent/50 ${
                  index === currentSlideIndex
                    ? 'border-accent bg-accent/10 shadow-lg shadow-accent/10'
                    : 'border-white/5 bg-white/5 hover:bg-white/10'
                }`}
                data-testid={`slide-thumb-${slide.index}`}
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="px-1.5 py-0.5 text-[10px] font-mono bg-white/10 rounded">
                    {slide.index}
                  </span>
                </div>
                <h4 className="font-semibold text-sm mb-2 line-clamp-1">{slide.title}</h4>
                <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-hidden">
                  {slide.bullets.slice(0, 5).map((bullet, i) => (
                    <li key={i} className="truncate flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-accent/50 shrink-0" />
                      {bullet}
                    </li>
                  ))}
                  {slide.bullets.length > 5 && (
                    <li className="text-accent text-[10px]">+{slide.bullets.length - 5} more</li>
                  )}
                </ul>
                {slide.speaker_note && (
                  <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-muted-foreground/70 line-clamp-1">
                    <span className="font-medium">Notes:</span> {slide.speaker_note}
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          // Presenter view - single slide with navigation
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
              <span>Slide {currentSlideIndex + 1} of {slides.length}</span>
              <span className="px-2 py-0.5 rounded bg-white/5">{latestPresentation.title}</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl min-h-[400px] flex flex-col">
              {/* Slide number badge */}
              <div className="mb-6">
                <span className="px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-mono">
                  {currentSlide.index}
                </span>
              </div>

              {/* Slide Title */}
              <h2 className="text-2xl font-heading font-bold mb-6 text-center">{currentSlide.title}</h2>

              {/* Bullets */}
              <ul className="flex-1 space-y-4 text-lg text-foreground/90">
                {currentSlide.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-3 animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                    <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2.5" />
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>

              {/* Speaker Notes */}
              {currentSlide.speaker_note && (
                <div className="mt-8 pt-6 border-t border-white/10">
                  <div className="flex items-center gap-2 text-xs text-accent mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="font-medium uppercase tracking-wide">Speaker Notes</span>
                  </div>
                  <p className="text-sm text-foreground/80 bg-accent/5 border border-accent/10 rounded-lg p-4">
                    {currentSlide.speaker_note}
                  </p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={prevSlide}
                disabled={currentSlideIndex === 0}
                className="w-14 h-14 rounded-full p-0"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-24 text-center">
                  {currentSlideIndex + 1} / {slides.length}
                </span>
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={nextSlide}
                disabled={currentSlideIndex === slides.length - 1}
                className="w-14 h-14 rounded-full p-0"
                aria-label="Next slide"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>

            {/* Thumbnail strip */}
            <div className="mt-8">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {slides.map((slide, index) => (
                  <button
                    key={slide.index}
                    onClick={() => goToSlide(index)}
                    className={`flex-shrink-0 w-20 h-14 rounded-lg border-2 p-2 transition-all ${
                      index === currentSlideIndex
                        ? 'border-accent bg-accent/10'
                        : 'border-white/5 bg-white/5 hover:border-white/20'
                    }`}
                    data-testid={`slide-nav-${slide.index}`}
                  >
                    <p className="text-[10px] font-semibold line-clamp-1 mb-1">{slide.title}</p>
                    <p className="text-[9px] text-muted-foreground line-clamp-2">{slide.bullets[0] || ''}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-white/10 bg-background/50 flex gap-2 shrink-0">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleGenerate}
          disabled={isGenerating}
          data-testid="regenerate-presentation-btn"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {isGenerating ? 'Regenerating...' : 'Regenerate'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(latestPresentation.id)}
          className="text-destructive hover:bg-destructive/10"
          data-testid="delete-presentation-btn"
        >
          Delete
        </Button>
      </div>
    </div>
  );
};