import { ChevronDown, Cpu } from 'lucide-react';
import { t } from '../../i18n';

interface HighlightModelSelectorProps {
  selectedModel: string | null;
  onModelSelect: (model: string | null) => void;
  disabled?: boolean;
}

export const HighlightModelSelector = ({
  selectedModel,
  onModelSelect,
  disabled = false,
}: HighlightModelSelectorProps) => {
  // Empty placeholder list - infrastructure ready for future models
  const availableModels: { code: string; name: string }[] = [];

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-muted-foreground">
        {t('highlightModel.label')}
      </label>
      <div className="relative">
        <select
          value={selectedModel || ''}
          onChange={(e) => onModelSelect(e.target.value || null)}
          disabled={disabled || availableModels.length === 0}
          className="w-full appearance-none bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground pr-8 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {availableModels.length === 0 ? (
            <option value="">{t('highlightModel.noModels')}</option>
          ) : (
            availableModels.map((model) => (
              <option key={model.code} value={model.code}>
                {model.name}
              </option>
            ))
          )}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
      {availableModels.length === 0 && (
        <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          {t('highlightModel.placeholder')}
        </p>
      )}
    </div>
  );
};
