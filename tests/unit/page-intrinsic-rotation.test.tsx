import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectiveRotation, normalizeRotation } from '../../src/lib/pageRotation';
import { HighlightEngine } from '../../src/lib/processing/HighlightEngine';

/**
 * Production break test (real browser, QA account): a PDF whose page carries /Rotate 90 (typical of
 * scans) was displayed UNROTATED, identical to the same file without /Rotate (`data-main-rotation`
 * "0", portrait). The reader passed its own rotation (0) to react-pdf, which treats an explicit
 * `rotate` as the absolute rotation and only uses the page's own /Rotate when none is given.
 */

const harness = vi.hoisted(() => ({
  pageProps: [] as Array<{ rotate?: number; onLoadSuccess?: (page: { rotate: number }) => void }>,
}));

vi.mock('react-pdf', () => ({
  Page: (props: { rotate?: number; onLoadSuccess?: (page: { rotate: number }) => void }) => {
    harness.pageProps.push(props);
    return <div data-testid="react-pdf-page" data-rotate={String(props.rotate)} />;
  },
}));
vi.mock('../../src/components/pdf/overlays/LayoutOverlay', () => ({ LayoutOverlay: () => null }));
vi.mock('../../src/components/pdf/overlays/OCROverlay', () => ({ OCROverlay: () => null }));
vi.mock('../../src/components/pdf/overlays/VisionOverlay', () => ({ VisionOverlay: () => null }));
vi.mock('../../src/stores/highlightStore', () => {
  const state = {
    activeHighlightId: null,
    setActiveHighlight: () => undefined,
    highlights: {
      'doc-1': [{ id: 'h1', page_index: 0, color: '#fef08a', text: 'hello', note: null, rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }] }],
    },
  };
  return { useHighlightStore: (select?: (s: typeof state) => unknown) => (select ? select(state) : state) };
});

import { PDFPage } from '../../src/components/pdf/PDFPage';
import { HighlightOverlay } from '../../src/components/pdf/overlays/HighlightOverlay';
import { usePageRegistryStore } from '../../src/stores/pageRegistryStore';
import { useViewerStore } from '../../src/stores/viewerStore';

const lastRotate = () => harness.pageProps[harness.pageProps.length - 1]?.rotate;

beforeEach(() => {
  harness.pageProps = [];
  usePageRegistryStore.getState().initializeRegistry(3);
  useViewerStore.setState({ documentId: 'doc-1', rotation: 0, scale: 1, showOverlays: true, pageLabels: [] });
});

describe('page rotation helpers', () => {
  it('normalises to a right angle', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(Number.NaN)).toBe(0);
  });

  it('adds the page\'s own rotation to the user\'s', () => {
    expect(effectiveRotation(undefined, 0)).toBe(0);
    expect(effectiveRotation(90, 0)).toBe(90);
    expect(effectiveRotation(90, 90)).toBe(180);
    expect(effectiveRotation(270, 180)).toBe(90);
    expect(effectiveRotation(0, 270)).toBe(270);
  });
});

describe('PDFPage', () => {
  it('lets react-pdf use the page\'s own /Rotate until the page has reported it', () => {
    render(<PDFPage pageIndex={0} width={600} />);

    expect(lastRotate()).toBeUndefined();
  });

  it('keeps the page\'s own /Rotate once it is known (a rotated scan is not shown sideways)', () => {
    render(<PDFPage pageIndex={0} width={600} />);

    act(() => harness.pageProps[0].onLoadSuccess?.({ rotate: 90 }));

    expect(lastRotate()).toBe(90);
    expect(usePageRegistryStore.getState().pages[0].intrinsicRotation).toBe(90);
  });

  it('adds the user\'s rotation on top of the page\'s own', () => {
    render(<PDFPage pageIndex={0} width={600} />);
    act(() => harness.pageProps[0].onLoadSuccess?.({ rotate: 90 }));

    act(() => useViewerStore.setState({ rotation: 90 }));

    expect(lastRotate()).toBe(180);
  });

  it('behaves exactly as before for a page without /Rotate', () => {
    render(<PDFPage pageIndex={0} width={600} />);
    act(() => harness.pageProps[0].onLoadSuccess?.({ rotate: 0 }));

    expect(lastRotate()).toBe(0);
    act(() => useViewerStore.setState({ rotation: 90 }));
    expect(lastRotate()).toBe(90);
  });

  it('tracks each page on its own', () => {
    render(<><PDFPage pageIndex={0} width={600} /><PDFPage pageIndex={1} width={600} /></>);

    act(() => {
      harness.pageProps.find((props) => props.onLoadSuccess)!.onLoadSuccess!({ rotate: 270 });
    });

    expect(usePageRegistryStore.getState().pages[0].intrinsicRotation).toBe(270);
    expect(usePageRegistryStore.getState().pages[1].intrinsicRotation).toBeUndefined();
  });
});

describe('HighlightOverlay', () => {
  const stored = [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }];
  const drawn = () => {
    const el = document.querySelector('[data-highlight-rect]') as HTMLElement;
    return { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
  };
  const expected = (rotation: number) => {
    const [rect] = HighlightEngine.canonicalRectsToRendered(stored, rotation);
    return {
      left: `${rect.x * 100}%`,
      top: `${rect.y * 100}%`,
      width: `${rect.width * 100}%`,
      height: `${rect.height * 100}%`,
    };
  };

  it('draws the stored rects at the rotation the page is displayed at (own /Rotate + user)', () => {
    usePageRegistryStore.getState().updatePage(0, { intrinsicRotation: 90 });
    useViewerStore.setState({ rotation: 90 });

    render(<HighlightOverlay pageIndex={0} />);

    expect(drawn()).toEqual(expected(180));
  });

  it('draws at the page\'s own rotation when the user did not rotate', () => {
    usePageRegistryStore.getState().updatePage(0, { intrinsicRotation: 270 });

    render(<HighlightOverlay pageIndex={0} />);

    expect(drawn()).toEqual(expected(270));
  });

  it('is unchanged for a page without /Rotate', () => {
    useViewerStore.setState({ rotation: 90 });

    render(<HighlightOverlay pageIndex={0} />);

    expect(drawn()).toEqual(expected(90));
    expect(screen.queryByTestId('react-pdf-page')).toBeNull();
  });
});
