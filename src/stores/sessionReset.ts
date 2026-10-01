/**
 * Zustand stores are module singletons: they outlive a login session. Without an
 * explicit reset, an account that signs in on the same tab inherits the previous
 * account's active workspace, documents, chat and credits until a hard reload.
 *
 * Stores register their own cleanup here instead of being imported by the auth store,
 * which keeps the lazily-loaded ones (chat, viewer, highlights…) out of the initial
 * bundle: a store that was never loaded has nothing to reset and never registers.
 */
type SessionReset = () => void;

const resets = new Set<SessionReset>();

/**
 * Changes every time the session ends or the account changes. A loader captures it before it awaits
 * the network and drops its answer when it no longer matches: resetting the stores is not enough on
 * its own, because a request that was already in flight would write the previous account's data
 * back into them a moment later.
 */
let sessionEpoch = 0;
export const getSessionEpoch = (): number => sessionEpoch;

export function registerSessionReset(reset: SessionReset): void {
  resets.add(reset);
}

/** Drop every per-user cache. Called when the session ends or the account changes. */
export function resetUserScopedState(): void {
  sessionEpoch += 1;
  for (const reset of resets) {
    try {
      reset();
    } catch (error) {
      // One failing store must not leave the remaining ones holding the old account's data.
      console.error('[sessionReset] A store failed to reset:', error);
    }
  }
}
