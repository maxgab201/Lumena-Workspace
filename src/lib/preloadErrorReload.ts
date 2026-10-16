import { readSession, writeSession } from './safeStorage';

const LAST_RELOAD_KEY = 'lumena.preloadErrorReloadAt';
/** A second failure inside this window is not a stale build: let it surface instead of reloading in a loop. */
export const PRELOAD_RELOAD_COOLDOWN_MS = 60_000;

type ReloadTarget = Pick<Window, 'addEventListener' | 'removeEventListener'> & { location: Pick<Location, 'reload'> };
/** Somewhere to remember, for this tab, that a reload already happened. `write` says whether it was stored. */
export interface ReloadMemory {
  read: (key: string) => string | null;
  write: (key: string, value: string) => boolean;
}

const tabMemory: ReloadMemory = { read: readSession, write: writeSession };

/**
 * After a deploy, a tab that was already open asks for hashed chunks that no longer exist. The SPA fallback
 * answers those requests with index.html, the dynamic import fails, and the page is left half working until
 * the user happens to reload. Vite reports it as `vite:preloadError`: reload once to pick up the new build.
 *
 * The reload is only allowed once the time of the attempt has been stored: if storage is blocked or full there
 * is no loop guard, so it does nothing and the error surfaces as it did before.
 */
export function installPreloadErrorReload(
  target: ReloadTarget = window,
  memory: ReloadMemory = tabMemory,
  now: () => number = Date.now,
): () => void {
  const onPreloadError = (event: Event) => {
    const last = Number(memory.read(LAST_RELOAD_KEY) ?? 0);
    if (now() - last < PRELOAD_RELOAD_COOLDOWN_MS) return;
    if (!memory.write(LAST_RELOAD_KEY, String(now()))) return;
    event.preventDefault();
    target.location.reload();
  };

  target.addEventListener('vite:preloadError', onPreloadError);
  return () => target.removeEventListener('vite:preloadError', onPreloadError);
}
