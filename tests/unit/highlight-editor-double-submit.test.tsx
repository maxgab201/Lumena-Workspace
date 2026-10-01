import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Production break test (real browser, real QA login): one text selection followed by a double-click
 * on a colour swatch inserted TWO identical highlights in the database. The second click arrived
 * before the first save returned and the selection was cleared, so the editor saved it twice.
 */
const harness = vi.hoisted(() => ({
  addHighlight: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('../../src/lib/processing/HighlightEngine', () => ({
  HighlightEngine: {
    extractHighlightFromSelection: () => ({
      pageIndex: 0,
      text: 'selected words',
      rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.02 }],
      screenX: 400,
      screenY: 300,
    }),
  },
}));

vi.mock('../../src/stores/highlightStore', () => ({
  useHighlightStore: () => ({ addHighlight: harness.addHighlight }),
}));

// Not under test; importing them for real pulls in the Supabase client and its env validation.
vi.mock('../../src/stores/workspaceStore', () => ({
  useWorkspaceStore: (select: (state: unknown) => unknown) => select({ activeWorkspace: { id: 'ws-1' } }),
}));
vi.mock('../../src/stores/uiStore', () => ({ useUiStore: { getState: () => ({ setActiveRightPanel: vi.fn() }) } }));
vi.mock('../../src/components/pdf/HighlightDetailPopover', () => ({ HighlightDetailPopover: () => null }));

import { HighlightEditor } from '../../src/components/pdf/HighlightEditor';
import { useViewerStore } from '../../src/stores/viewerStore';

function selectSomeText() {
  const host = document.createElement('p');
  host.textContent = 'selected words in the page';
  document.body.appendChild(host);
  const range = document.createRange();
  range.selectNodeContents(host);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return host;
}

async function openToolbar() {
  vi.useFakeTimers();
  const host = selectSomeText();
  await act(async () => {
    fireEvent.mouseUp(host);
    await vi.advanceTimersByTimeAsync(20);
  });
  vi.useRealTimers();
  return host;
}

beforeEach(() => {
  harness.addHighlight.mockReset();
  useViewerStore.setState({ documentId: 'doc-1' });
});

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

describe('HighlightEditor', () => {
  it('saves the highlight once when the colour is double-clicked', async () => {
    let finishSave: (value: unknown) => void = () => undefined;
    harness.addHighlight.mockImplementation(() => new Promise((resolve) => { finishSave = resolve; }));
    render(<HighlightEditor workspaceId="ws-1" />);
    await openToolbar();

    const swatch = screen.getByRole('button', { name: 'Subrayar en Amarillo' });
    fireEvent.click(swatch);
    fireEvent.click(swatch); // second click of the double-click, before the first save returned

    expect(harness.addHighlight).toHaveBeenCalledTimes(1);
    await act(async () => finishSave({ id: 'h1' }));
  });

  it('closes the toolbar and clears the selection once the save worked', async () => {
    harness.addHighlight.mockResolvedValue({ id: 'h1' });
    render(<HighlightEditor workspaceId="ws-1" />);
    await openToolbar();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Subrayar en Verde' }));
    });

    expect(screen.queryByTestId('highlight-editor')).toBeNull();
    expect(window.getSelection()?.isCollapsed).toBe(true);
  });

  it('keeps the toolbar and the selection when the save failed, so one click retries it', async () => {
    harness.addHighlight.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'h2' });
    render(<HighlightEditor workspaceId="ws-1" />);
    await openToolbar();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Subrayar en Azul' }));
    });

    expect(screen.getByTestId('highlight-editor')).toBeTruthy();
    expect(window.getSelection()?.isCollapsed).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Subrayar en Azul' }));
    });

    expect(harness.addHighlight).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('highlight-editor')).toBeNull();
  });
});
