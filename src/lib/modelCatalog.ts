/**
 * Client-side model catalog — single source for Chat & AI Highlight selectors.
 * Reads from /functions/v1/ai-config (cached), falls back to static seed if the
 * endpoint is unreachable (never breaks Chat/Highlight).
 */
import { getConfigCache, setConfigCache } from './modelCache'

export interface CatalogModelUI {
  provider: 'google' | 'openrouter'
  model_id: string
  display_name: string
  tier: 'free' | 'pro'
  capabilities: string[]
  available: boolean
  locked?: boolean
}

export interface AiConfigResponse {
  plan: 'free' | 'pro'
  quota: { used: number; limit: number; resets_at: string }
  models: CatalogModelUI[]
  free_default_chat: string
  free_default_highlight: string
  free_models: string[]
  request_id?: string
}

export const FREE_LIMIT = 50

const STATIC_UI: CatalogModelUI[] = [
  { provider: 'google', model_id: 'gemini-3.1-flash-lite', display_name: 'Gemini 3.1 Flash Lite', tier: 'free', capabilities: ['chat', 'ai_highlight'], available: true },
  { provider: 'google', model_id: 'gemini-3.5-flash-lite', display_name: 'Gemini 3.5 Flash Lite', tier: 'free', capabilities: ['chat', 'ai_highlight'], available: true },
  { provider: 'openrouter', model_id: 'nex-agi/nex-n2.5-pro:free', display_name: 'Nex N2.5 Pro (Free)', tier: 'free', capabilities: ['chat'], available: true },
  { provider: 'google', model_id: 'gemini-3.6-flash', display_name: 'Gemini 3.6 Flash', tier: 'pro', capabilities: ['chat', 'ai_highlight'], available: true },
  { provider: 'google', model_id: 'gemini-3.6-pro', display_name: 'Gemini 3.6 Pro', tier: 'pro', capabilities: ['chat', 'ai_highlight'], available: true },
]

export async function fetchAiConfig(workspaceId?: string, signal?: AbortSignal): Promise<AiConfigResponse> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-config?workspace_id=${encodeURIComponent(workspaceId ?? '')}`
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal })
    if (!res.ok) throw new Error(`ai-config ${res.status}`)
    const data = (await res.json()) as Partial<AiConfigResponse>
    setConfigCache(data as AiConfigResponse)
    return data as AiConfigResponse
  } catch {
    return getConfigCache() ?? {
      plan: 'free',
      quota: { used: 0, limit: FREE_LIMIT, resets_at: new Date(Date.now() + 86400000).toISOString() },
      models: STATIC_UI.map((m) => ({ ...m, locked: false, freeBadge: m.tier === 'free', proBadge: m.tier === 'pro' })),
      free_default_chat: 'gemini-3.5-flash-lite',
      free_default_highlight: 'gemini-3.5-flash-lite',
      free_models: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'nex-agi/nex-n2.5-pro:free'],
    }
  }
}
