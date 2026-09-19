import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { fetchAiConfig, type CatalogModelUI, STATIC_UI } from '../../lib/modelCatalog';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface ModelSelectorPanelProps {
  selectedModel: string;
  onChange: (modelId: string) => void;
  plan: string;
  capability?: 'chat' | 'ai_highlight';
  disabled?: boolean;
}

export function ModelSelectorPanel({
  selectedModel,
  onChange,
  plan,
  capability = 'chat',
  disabled = false,
}: ModelSelectorPanelProps) {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspace?.id ?? '');
  const [catalog, setCatalog] = useState<CatalogModelUI[] | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number; resets_at: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAiConfig(workspaceId)
      .then((cfg) => {
        if (cancelled) return;
        setCatalog(cfg.models);
        setQuota(cfg.quota);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog(STATIC_UI as CatalogModelUI[]);
        setQuota(null);
      });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const usable = (catalog ?? STATIC_UI)
    .filter((m) => m.available !== false && m.capabilities.includes(capability));
  const freeList = usable.filter((m) => m.tier === 'free');
  const proList = usable.filter((m) => m.tier === 'pro');

  const renderList = (list: CatalogModelUI[]) =>
    list.map((m) => {
      const locked = plan === 'free' && m.tier === 'pro';
      return (
        <button
          key={m.model_id}
          type="button"
          disabled={disabled || locked}
          onClick={() => onChange(m.model_id)}
          title={m.display_name + (m.tier === 'pro' ? ' (Pro)' : ' (Free)')}
          className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-all ${
            selectedModel === m.model_id
              ? 'border-accent/50 bg-accent/10 text-accent font-medium'
              : locked
                ? 'border-white/5 bg-secondary/10 text-muted-foreground/40 cursor-not-allowed'
                : 'border-white/5 bg-secondary/20 text-muted-foreground hover:text-foreground hover:border-white/20'
          }`}
        >
          <span className="flex items-center gap-1.5">{m.display_name}</span>
          {m.tier === 'free'
            ? <span className="text-[10px] font-semibold text-emerald-400">FREE</span>
            : <span className="flex items-center gap-1 text-[10px] text-accent/70 font-semibold"><Lock className="w-3 h-3" /> Pro</span>}
        </button>
      );
    });

  return (
    <div className="flex flex-col gap-1" data-testid={`model-selector-${capability}`}>
      <div className="flex flex-col gap-1">
        {freeList.length > 0 && (
          <>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gratuito</p>
            {renderList(freeList)}
          </>
        )}
        {proList.length > 0 && (
          <>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Pro</p>
            {renderList(proList)}
          </>
        )}
      </div>
      {quota ? (
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {quota.used} / {quota.limit} AI requests today · reset {new Date(quota.resets_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </p>
      ) : null}
    </div>
  );
}
