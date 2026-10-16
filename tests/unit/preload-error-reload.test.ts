import { afterEach, describe, expect, it, vi } from 'vitest';
import { installPreloadErrorReload } from '../../src/lib/preloadErrorReload';
import { readSession, writeSession } from '../../src/lib/safeStorage';

/**
 * After a deploy, a tab that was already open asks for hashed chunks that no longer exist. The SPA
 * fallback answers those requests with index.html, the dynamic import fails, and the page is left
 * half working until the user happens to reload. Vite reports it as `vite:preloadError`.
 */
function harness(storage: Record<string, string> | 'blocked' = {}) {
  const listeners = new Map<string, (event: Event) => void>();
  const reload = vi.fn();
  const target = {
    addEventListener: (type: string, listener: (event: Event) => void) => void listeners.set(type, listener),
    removeEventListener: (type: string) => void listeners.delete(type),
    location: { reload },
  };
  const store = new Map(Object.entries(storage === 'blocked' ? {} : storage));
  const memory = {
    read: (key: string) => (storage === 'blocked' ? null : store.get(key) ?? null),
    // blocked storage (Safari "block all cookies", full quota) refuses every write
    write: (key: string, value: string) => (storage === 'blocked' ? false : (store.set(key, value), true)),
  };
  let now = 1_000_000;
  const stop = installPreloadErrorReload(target, memory, () => now);
  const fire = () => {
    const event = new Event('vite:preloadError', { cancelable: true });
    listeners.get('vite:preloadError')?.(event);
    return event;
  };
  return { fire, reload, stop, listeners, advance: (ms: number) => { now += ms; } };
}

describe('installPreloadErrorReload', () => {
  it('reloads once to pick up the new build and cancels the error', () => {
    const h = harness();

    const event = h.fire();

    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not reload again right away: if the failure is not a stale build, the error must surface instead of looping', () => {
    const h = harness();

    h.fire();
    h.advance(5_000);
    const second = h.fire();

    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
  });

  it('may reload again after the cooldown', () => {
    const h = harness();

    h.fire();
    h.advance(61_000);
    h.fire();

    expect(h.reload).toHaveBeenCalledTimes(2);
  });

  it('never reloads when it cannot store that it already did (blocked or full storage means no loop guard)', () => {
    const h = harness('blocked');

    const event = h.fire();

    expect(h.reload).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('can be uninstalled', () => {
    const h = harness();

    h.stop();

    expect(h.listeners.has('vite:preloadError')).toBe(false);
  });
});

describe('the tab memory behind it (safeStorage session helpers)', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  afterEach(() => {
    if (original) Object.defineProperty(window, 'sessionStorage', original);
  });

  it('stores and reads a value for this tab', () => {
    expect(writeSession('k', 'v')).toBe(true);
    expect(readSession('k')).toBe('v');
  });

  it('never throws when the browser blocks storage, and says the value was not stored', () => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });

    expect(readSession('k')).toBeNull();
    expect(writeSession('k', 'v')).toBe(false);
  });

  it('says the value was not stored when the quota is full', () => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } },
    });

    expect(writeSession('k', 'v')).toBe(false);
  });
});
