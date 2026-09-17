import type { AiConfigResponse } from './modelCatalog'

const KEY = 'lumena:ai_config_cache'

export function getConfigCache(): AiConfigResponse | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AiConfigResponse & { _cachedAt?: number }
    if (parsed._cachedAt && Date.now() - parsed._cachedAt > 10 * 60 * 1000) return null
    return parsed
  } catch {
    return null
  }
}

export function setConfigCache(v: AiConfigResponse): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...v, _cachedAt: Date.now() }))
  } catch {
    // ignore storage errors
  }
}
