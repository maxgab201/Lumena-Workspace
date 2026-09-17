/**
 * ─── MODEL CATALOG — single source of truth (server-side) ──────────────────
 * Shared by ai-gateway, ai-highlight and ai-config.
 *
 * Tier rules (EXACT, per product spec):
 *   FREE = Gemini whitelist [gemini-3.1-flash-lite, gemini-3.5-flash-lite]
 *          OR any OpenRouter model id ending in ':free'
 *   everything else = PRO
 *
 * Pro models stay VISIBLE in the catalog (the frontend renders them with a
 * lock), so the catalog always includes them with available=true.
 *
 * Dynamic sources are best-effort: OpenRouter's public models list and
 * Gemini's ListModels (server-side only, API key never leaves the server).
 * On failure we serve the last good cache or the static seed — the catalog
 * must never break Chat.
 */

export type Tier = 'free' | 'pro'
export type CatalogProvider = 'google' | 'openrouter'

export interface CatalogModel {
  provider: CatalogProvider
  model_id: string
  display_name: string
  tier: Tier
  capabilities: string[] // 'chat' | 'ai_highlight'
  available: boolean
}

/** Gemini models a Free plan may use (exact whitelist). */
export const GEMINI_FREE_WHITELIST = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
] as const

/** Default free models per capability (used when the user has no preference). */
export const DEFAULT_CHAT_FREE_MODEL = 'gemini-3.5-flash-lite'
export const DEFAULT_HIGHLIGHT_FREE_MODEL = 'gemini-3.5-flash-lite'

/** Free plan daily AI request quota, shared by Chat + AI Highlight. */
export const FREE_DAILY_LIMIT = 50

/** Static seed — always complete, used when dynamic discovery fails. */
export const STATIC_CATALOG: CatalogModel[] = [
  { provider: 'google', model_id: 'gemini-3.1-flash-lite', display_name: 'Gemini 3.1 Flash Lite', tier: 'free', capabilities: ['chat', 'ai_highlight'], available: true },
  { provider: 'google', model_id: 'gemini-3.5-flash-lite', display_name: 'Gemini 3.5 Flash Lite', tier: 'free', capabilities: ['chat', 'ai_highlight'], available: true },
  { provider: 'openrouter', model_id: 'nex-agi/nex-n2.5-pro:free', display_name: 'Nex N2.5 Pro (Free)', tier: 'free', capabilities: ['chat'], available: true },
  { provider: 'google', model_id: 'gemini-3.6-flash', display_name: 'Gemini 3.6 Flash', tier: 'pro', capabilities: ['chat', 'ai_highlight'], available: true },
  { provider: 'google', model_id: 'gemini-3.6-pro', display_name: 'Gemini 3.6 Pro', tier: 'pro', capabilities: ['chat', 'ai_highlight'], available: true },
]

/** EXACT tier rule — the only place it lives. */
export function tierOf(modelId: string): Tier {
  if (!modelId) return 'pro'
  if ((GEMINI_FREE_WHITELIST as readonly string[]).includes(modelId)) return 'free'
  if (modelId.endsWith(':free')) return 'free'
  return 'pro'
}

let memCache: { at: number; models: CatalogModel[] } | null = null
const CACHE_TTL_MS = 30 * 60 * 1000

async function fetchOpenRouterFree(): Promise<CatalogModel[]> {
  // Public endpoint, no API key needed for listing.
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`openrouter list ${res.status}`)
  const json = await res.json()
  const models = Array.isArray(json?.data) ? json.data : []
  return models
    .filter((m: any) => typeof m?.id === 'string' && m.id.endsWith(':free'))
    .slice(0, 60)
    .map((m: any) => ({
      provider: 'openrouter' as const,
      model_id: m.id,
      display_name: m.name || m.id,
      tier: 'free' as const,
      capabilities: ['chat'],
      available: true,
    }))
}

async function fetchGeminiAvailable(): Promise<Set<string>> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
  if (!apiKey) return new Set()
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`,
    { signal: AbortSignal.timeout(8000) },
  )
  if (!res.ok) throw new Error(`gemini list ${res.status}`)
  const json = await res.json()
  const ids = new Set<string>()
  for (const m of json?.models ?? []) {
    const id = String(m?.name ?? '').replace('models/', '')
    if (id && Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent')) {
      ids.add(id)
    }
  }
  return ids
}

function mergeCatalog(dynamic: CatalogModel[]): CatalogModel[] {
  const byId = new Map<string, CatalogModel>()
  for (const m of STATIC_CATALOG) byId.set(m.model_id, { ...m })
  for (const m of dynamic) if (!byId.has(m.model_id)) byId.set(m.model_id, m)
  // Gemini whitelist models must always be present even if ListModels failed.
  return [...byId.values()]
}

/**
 * Returns the full catalog (free + pro). Never throws: on failure it serves
 * the in-memory cache, then the static seed.
 */
export async function getCatalog(): Promise<CatalogModel[]> {
  if (memCache && Date.now() - memCache.at < CACHE_TTL_MS) return memCache.models
  const dynamic: CatalogModel[] = []
  try {
    const [orModels, geminiIds] = await Promise.all([
      fetchOpenRouterFree().catch(() => [] as CatalogModel[]),
      fetchGeminiAvailable().catch(() => new Set<string>()),
    ])
    dynamic.push(...orModels)
    // Mark Gemini whitelist models unavailable only if ListModels worked and
    // explicitly does not know them (avoids offering dead models).
    if (geminiIds.size > 0) {
      for (const m of STATIC_CATALOG) {
        if (m.provider === 'google' && !geminiIds.has(m.model_id)) {
          dynamic.push({ ...m, available: false })
        }
      }
    }
  } catch {
    // fall through to cache / static seed
  }
  const models = mergeCatalog(dynamic)
  memCache = { at: Date.now(), models }
  return models
}

/** Resolves the workspace plan from subscriptions (billing is read-only here). */
export async function resolvePlan(
  supabase: any,
  workspaceId: string,
): Promise<'free' | 'pro'> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan_code')
    .eq('workspace_id', workspaceId)
    .single()
  return data?.plan_code === 'pro' ? 'pro' : 'free'
}

export function quotaInfo(used: number): { limit: number; resets_at: string } {
  // Resets at 00:00 UTC of the next day.
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  return { limit: FREE_DAILY_LIMIT, resets_at: next.toISOString() }
}
