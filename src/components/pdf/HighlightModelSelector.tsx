import { useState } from 'react';
import { ChevronDown, FileText, Image, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { t } from '../../i18n';

interface HighlightModelSelectorProps {
  selectedModel: string | null;
  onModelSelect: (model: string | null) => void;
  disabled?: boolean;
}

const MODEL_TYPES = [
  {
    id: 'text-ocr',
    name: t('highlightModel.textOcr'),
    description: t('highlightModel.textOcrDesc'),
    icon: FileText,
    available: true,
  },
  {
    id: 'image-ocr',
    name: t('highlightModel.imageOcr'),
    description: t('highlightModel.imageOcrDesc'),
    icon: Image,
    available: false,
  },
  {
    id: 'ai-highlight',
    name: t('highlightModel.aiHighlight'),
    description: t('highlightModel.aiHighlightDesc'),
    icon: Sparkles,
    available: false,
  },
];

export const HighlightModelSelector = ({
  selectedModel,
  onModelSelect,
  disabled = false,
}: HighlightModelSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedModelData = MODEL_TYPES.find(m => m.id === selectedModel) || MODEL_TYPES[0];

  return (
    <div className="relative">
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        {t('highlightModel.label')}
      </label>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full justify-between text-left h-9"
      >
        <span className="flex items-center gap-2">
          <selectedModelData.icon className="h-4 w-4" />
          {selectedModelData.name}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-white/10 rounded-lg shadow-lg z-50 overflow-hidden">
          {MODEL_TYPES.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onModelSelect(model.id);
                setIsOpen(false);
              }}
              disabled={!model.available}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary/50 transition-colors ${
                selectedModel === model.id ? 'bg-accent/10 text-accent' : ''
              } ${!model.available ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <model.icon className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{model.name}</p>
                <p className="text-xs text-muted-foreground truncate">{model.description}</p>
              </div>
              {!model.available && (
                <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
                  {t('highlightModel.comingSoon')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
