/**
 * localStorage that never throws. Reading `window.localStorage` itself throws a SecurityError when
 * the browser blocks site data (Safari "block all cookies", Firefox strict mode, a sandboxed
 * iframe), and setItem throws when the quota is full. Every value kept here is a per-viewer
 * convenience (language, model choice, local page-label fallback), so on failure the app falls
 * back to its default instead of crashing.
 */

export function readStorage(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns whether the value was stored. */
export function writeStorage(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  } catch {
    // nothing to clean up if storage is unavailable
  }
}
