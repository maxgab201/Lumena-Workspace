import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { fetchAiConfig, type CatalogModelUI, FREE_LIMIT, STATIC_UI } from '../../lib/modelCatalog';
import { useViewerStore } from '../../stores/viewerStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export function ModelSelectorPanel({ selectedModel, onChange, plan }: { selectedModel: string; onChange: (m: string) => void; plan: string }) {
  const [catalog, setCatalog] = useState<CatalogModelUI[] | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number; resets_at: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const wsId = (useViewerStore.getState().activeWorkspace?.id || useWorkspaceStore.getState().activeWorkspace?.id || '');
    fetchAiConfig(wsId || '').then((cfg) => { if (!cancelled) { setCatalog(cfg.models); setQuota(cfg.quota); } }).catch(() => { if (!cancelled) { setCatalog(STATIC_UI as CatalogModelUI[]); setQuota({ used: 0, limit: 50, resets_at: new Date(Date.now() + 86400000).toISOString() }); } });
    return () => { cancelled = true };
  }, []);
  const freeList = catalog?.filter((m) => m.tier === 'free') ?? [];
  const proList = catalog?.filter((m) => m.tier === 'pro') ?? [];
  const display = (list: CatalogModelUI[]) =>
    list.map((m) => (
      <button
        key={m.model_id}
        disabled={plan === 'free' && m.tier === 'pro'}
        onClick={() => onChange(m.model_id)}
        title={m.display_name + (m.tier === 'pro' ? ' (Pro)' : ' (Free)')}
        className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-all ${selectedModel === m.model_id ? 'border-accent/50 bg-accent/10 text-accent font-medium' : m.tier === 'pro' && plan === 'free' ? 'border-white/5 bg-secondary/10 text-muted-foreground/40 cursor-not-allowed' : 'border-white/5 bg-secondary/20 text-muted-foreground hover:text-foreground hover:border-white/20'}`}
      >
        <span className="flex items-center gap-1.5">{m.display_name}</span>
        {m.tier === 'free' ? <span className="text-[10px] font-semibold text-emerald-400">FREE</span> : <span className="flex items-center gap-1 text-[10px] text-accent/70 font-semibold"><Lock className="w-3 h-3" /> Pro</span>}
      </button>
    ));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gratuito</p>
        {display(freeList)}
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Pro</p>
        {display(proList)}
      </div>
      {quota ? <p className="text-[10px] text-muted-foreground/60 mt-0.5">{quota.used} / {quota.limit} AI requests today · resets {new Date(quota.resets_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} UTC</p> : null}
    </div>
  );
}
