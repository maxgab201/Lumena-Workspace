import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_REFRESH_INTERVAL_MS, useRefreshOnReturn } from '../../src/lib/useRefreshOnReturn';

/**
 * Production evidence (real browser, real QA login): two tabs of one account on the dashboard; a document uploaded in
 * tab 1 never appeared in tab 2, not even after switching back to it. No table is in the `supabase_realtime`
 * publication, so nothing arrives on its own; the list has to be refreshed when the user comes back.
 */
function Probe({ refresh, now }: { refresh: () => void; now: () => number }) {
  useRefreshOnReturn(refresh, MIN_REFRESH_INTERVAL_MS, now);
  return null;
}

let clock = 0;
const now = () => clock;
const setVisibility = (state: 'visible' | 'hidden') => Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

beforeEach(() => {
  clock = 1_000_000;
  setVisibility('visible');
});
afterEach(() => setVisibility('visible'));

const comeBack = () => act(() => { document.dispatchEvent(new Event('visibilitychange')); });

describe('useRefreshOnReturn', () => {
  it('refreshes when the user comes back to the tab', () => {
    const refresh = vi.fn();
    render(<Probe refresh={refresh} now={now} />);
    clock += MIN_REFRESH_INTERVAL_MS + 1;
    comeBack();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('also refreshes when the window regains focus or the network returns', () => {
    const refresh = vi.fn();
    render(<Probe refresh={refresh} now={now} />);
    clock += MIN_REFRESH_INTERVAL_MS + 1;
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(refresh).toHaveBeenCalledTimes(1);
    clock += MIN_REFRESH_INTERVAL_MS + 1;
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the tab is going away (hidden)', () => {
    const refresh = vi.fn();
    render(<Probe refresh={refresh} now={now} />);
    clock += MIN_REFRESH_INTERVAL_MS + 1;
    setVisibility('hidden');
    comeBack();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('is throttled: a burst of focus and visibility events is one refresh', () => {
    const refresh = vi.fn();
    render(<Probe refresh={refresh} now={now} />);
    clock += MIN_REFRESH_INTERVAL_MS + 1;
    comeBack();
    act(() => { window.dispatchEvent(new Event('focus')); });
    comeBack();
    expect(refresh).toHaveBeenCalledTimes(1);
    clock += MIN_REFRESH_INTERVAL_MS + 1;
    comeBack();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not refresh right after the page loaded its own data', () => {
    const refresh = vi.fn();
    render(<Probe refresh={refresh} now={now} />);
    clock += 1_000;
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('always calls the latest callback and stops listening on unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(<Probe refresh={first} now={now} />);
    view.rerender(<Probe refresh={second} now={now} />);
    clock += MIN_REFRESH_INTERVAL_MS + 1;
    comeBack();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    view.unmount();
    clock += MIN_REFRESH_INTERVAL_MS + 1;
    comeBack();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('the pages use it', () => {
  it('Dashboard re-reads the documents and the Viewer re-reads the highlights', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const read = (path: string) => readFileSync(resolve(__dirname, '../../', path), 'utf8');
    expect(read('src/pages/Dashboard.tsx')).toMatch(/useRefreshOnReturn\(\(\) => \{[\s\S]*reconcileDocumentStatuses\(current\.id\)/);
    expect(read('src/pages/Viewer.tsx')).toMatch(/useRefreshOnReturn\(\(\) => \{[\s\S]*loadHighlights\(documentId\)/);
  });
});
