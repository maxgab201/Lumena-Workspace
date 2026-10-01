import { useEffect, useRef } from 'react';

/** The least time between two refreshes: switching windows back and forth must not become a request storm. */
export const MIN_REFRESH_INTERVAL_MS = 5_000;

/**
 * Runs `refresh` when the user comes back to this tab: it becomes visible again, the window regains focus, or the
 * network returns.
 *
 * Supabase Realtime is not enabled for any table in this project (none is in the `supabase_realtime` publication),
 * so a change made in another tab or on another device never arrives by itself: in a real browser, a document
 * uploaded in tab 1 never showed up in tab 2 of the same account until it was reloaded. Refreshing on return
 * fixes what the user actually sees without needing it.
 */
export function useRefreshOnReturn(refresh: () => void, minIntervalMs: number = MIN_REFRESH_INTERVAL_MS, now: () => number = Date.now): void {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    // The page just loaded its data: the first return only counts after the interval.
    let lastRefresh = now();
    const refreshIfDue = () => {
      if (document.visibilityState === 'hidden') return;
      const current = now();
      if (current - lastRefresh < minIntervalMs) return;
      lastRefresh = current;
      latest.current();
    };
    document.addEventListener('visibilitychange', refreshIfDue);
    window.addEventListener('focus', refreshIfDue);
    window.addEventListener('online', refreshIfDue);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfDue);
      window.removeEventListener('focus', refreshIfDue);
      window.removeEventListener('online', refreshIfDue);
    };
  }, [minIntervalMs, now]);
}
