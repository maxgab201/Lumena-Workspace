import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_CANVAS_PIXELS,
  MAX_CANVAS_PIXELS_HIGH_DPR,
  MAX_CANVAS_PIXELS_IOS,
  isIosLike,
  maxCanvasPixelsFor,
  overscanForScale,
  pagePixelRatio,
} from '../../src/lib/canvasBudget';

/**
 * Measured in a real browser on a 900-page document: at the maximum zoom (500%) twelve canvases held 409 million
 * pixels and the browser used 3.1 GB (0.9 GB again after zooming out). react-pdf draws at width × devicePixelRatio
 * without a bound, and iOS Safari draws nothing on a canvas above about 16.7 million pixels. After the fix: 4
 * canvases, 101 million pixels, 1.75 GB; normal zoom unchanged.
 */
describe('pagePixelRatio', () => {
  const letterAt = (zoom: number) => [1072 * zoom, 1387 * zoom] as const;

  it('leaves normal zoom alone, at any screen density', () => {
    expect(pagePixelRatio(...letterAt(1), 1)).toBe(1);
    expect(pagePixelRatio(...letterAt(1), 2)).toBe(2);
    expect(pagePixelRatio(...letterAt(2), 1)).toBe(1);
  });

  it('lowers the ratio only when the canvas would pass the cap', () => {
    const [w, h] = letterAt(5); // 5360 x 6935: 37 million pixels at ratio 1
    const ratio = pagePixelRatio(w, h, 1);
    expect(ratio).toBeLessThan(1);
    expect(w * ratio * (h * ratio)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS * 1.0001);
  });

  it('keeps a retina screen within the cap too (4 times the pixels at ratio 2)', () => {
    const [w, h] = letterAt(3);
    const ratio = pagePixelRatio(w, h, 2);
    expect(w * ratio * (h * ratio)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS * 1.0001);
    expect(ratio).toBeLessThan(2);
  });

  it('never raises the ratio above the screen\'s own', () => {
    expect(pagePixelRatio(300, 400, 1)).toBe(1);
    expect(pagePixelRatio(300, 400, 3)).toBe(3);
  });

  it('keeps a floor so a huge page stays readable instead of collapsing', () => {
    expect(pagePixelRatio(40_000, 40_000, 1)).toBe(0.25);
  });

  it('does not break on nonsense input', () => {
    expect(pagePixelRatio(0, 0, 2)).toBe(2);
    expect(pagePixelRatio(Number.NaN, 100, 2)).toBe(2);
    expect(pagePixelRatio(100, 100, Number.NaN)).toBe(1);
    expect(pagePixelRatio(100, 100, 0)).toBe(1);
  });

  it('uses the lower cap iOS can draw', () => {
    const [w, h] = letterAt(2); // 2144 x 2774 = 5.9 million pixels at ratio 1, 23.8 million at ratio 2
    const ratio = pagePixelRatio(w, h, 2, MAX_CANVAS_PIXELS_IOS);
    expect(w * ratio * (h * ratio)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS_IOS * 1.0001);
    expect(pagePixelRatio(w, h, 2, MAX_CANVAS_PIXELS)).toBeGreaterThan(ratio);
  });
});

describe('platform detection', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
  const ipadAsMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
  const desktopMac = ipadAsMac;
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

  it('recognises iPhone and iPadOS (which reports itself as a Mac with a touch screen)', () => {
    expect(isIosLike(iphone, 5)).toBe(true);
    expect(isIosLike(ipadAsMac, 5)).toBe(true);
    expect(isIosLike(desktopMac, 0)).toBe(false);
    expect(isIosLike(windows, 0)).toBe(false);
  });

  it('picks the cap for the platform', () => {
    expect(maxCanvasPixelsFor(iphone, 5)).toBe(MAX_CANVAS_PIXELS_IOS);
    expect(maxCanvasPixelsFor(windows, 0)).toBe(MAX_CANVAS_PIXELS);
    expect(maxCanvasPixelsFor(windows, 0, 3)).toBe(MAX_CANVAS_PIXELS_HIGH_DPR);
  });
});

describe('overscanForScale', () => {
  it('keeps the generous prefetch at normal zoom and shrinks it as pages get huge', () => {
    expect(overscanForScale(1)).toBe(5);
    expect(overscanForScale(1.5)).toBe(5);
    expect(overscanForScale(2)).toBe(2);
    expect(overscanForScale(2.5)).toBe(2);
    expect(overscanForScale(3)).toBe(1);
    expect(overscanForScale(5)).toBe(1);
  });

  it('caps prefetch on dense screens before mounted page canvases exhaust browser memory', () => {
    expect(overscanForScale(1, 2)).toBe(2);
    expect(overscanForScale(1.5, 3)).toBe(0);
    expect(overscanForScale(2, 3)).toBe(0);
    expect(overscanForScale(5, 3)).toBe(0);
  });
});

describe('the reader applies the budget', () => {
  const harness = vi.hoisted(() => ({ pageProps: [] as Array<{ devicePixelRatio?: number; width?: number; onLoadSuccess?: (page: unknown) => void }> }));
  vi.mock('react-pdf', () => ({
    Page: (props: { devicePixelRatio?: number; width?: number; onLoadSuccess?: (page: unknown) => void }) => {
      harness.pageProps.push(props);
      return <div data-testid="react-pdf-page" />;
    },
  }));
  vi.mock('../../src/components/pdf/overlays/LayoutOverlay', () => ({ LayoutOverlay: () => null }));
  vi.mock('../../src/components/pdf/overlays/OCROverlay', () => ({ OCROverlay: () => null }));
  vi.mock('../../src/components/pdf/overlays/VisionOverlay', () => ({ VisionOverlay: () => null }));
  vi.mock('../../src/components/pdf/overlays/HighlightOverlay', () => ({ HighlightOverlay: () => null }));

  const lastRatio = () => harness.pageProps[harness.pageProps.length - 1]?.devicePixelRatio;

  beforeEach(async () => {
    harness.pageProps = [];
    const { usePageRegistryStore } = await import('../../src/stores/pageRegistryStore');
    const { useViewerStore } = await import('../../src/stores/viewerStore');
    usePageRegistryStore.getState().initializeRegistry(3);
    useViewerStore.setState({ documentId: 'doc', rotation: 0, scale: 1, showOverlays: false, pageLabels: [] } as never);
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });

  it('passes the screen\'s own ratio to react-pdf at normal zoom', async () => {
    const { PDFPage } = await import('../../src/components/pdf/PDFPage');
    render(<PDFPage pageIndex={0} width={1072} />);
    expect(lastRatio()).toBe(1);
  });

  it('draws a page at maximum zoom at a lower ratio, using the page\'s real shape once it has loaded', async () => {
    const { PDFPage } = await import('../../src/components/pdf/PDFPage');
    const { useViewerStore } = await import('../../src/stores/viewerStore');
    useViewerStore.setState({ scale: 5 } as never);
    render(<PDFPage pageIndex={0} width={1072} />);
    const assumingA4 = lastRatio()!;
    expect(assumingA4).toBeLessThan(1);

    // a very tall strip (400 x 1400 pt) at 500%: 5360 x 18760 css px, far more than A4 would have been
    await act(async () => { harness.pageProps[harness.pageProps.length - 1].onLoadSuccess?.({ rotate: 0, originalWidth: 400, originalHeight: 1400 }); });
    expect(lastRatio()!).toBeLessThan(assumingA4);
    const targetWidth = Math.floor(1072 * 5);
    expect(targetWidth * lastRatio()! * (targetWidth * 3.5 * lastRatio()!)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS * 1.001);
  });

  it('applies the smaller canvas limit to a high-DPR screen', async () => {
    const { PDFPage } = await import('../../src/components/pdf/PDFPage');
    const { useViewerStore } = await import('../../src/stores/viewerStore');
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    useViewerStore.setState({ scale: 5 } as never);
    render(<PDFPage pageIndex={0} width={1072} />);

    const targetWidth = Math.floor(1072 * 5);
    const ratio = lastRatio()!;
    expect(targetWidth * ratio * (targetWidth * 1.414 * ratio)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS_HIGH_DPR * 1.001);
  });

  it('turns the shape when the page is shown rotated a quarter turn', async () => {
    const { PDFPage } = await import('../../src/components/pdf/PDFPage');
    const { useViewerStore } = await import('../../src/stores/viewerStore');
    const { usePageRegistryStore } = await import('../../src/stores/pageRegistryStore');
    useViewerStore.setState({ scale: 5 } as never);
    usePageRegistryStore.getState().updatePage(0, { intrinsicRotation: 0 });
    render(<PDFPage pageIndex={0} width={1072} />);
    await act(async () => { harness.pageProps[harness.pageProps.length - 1].onLoadSuccess?.({ rotate: 0, originalWidth: 400, originalHeight: 1400 }); });
    const tall = lastRatio()!;

    await act(async () => { useViewerStore.setState({ rotation: 90 } as never); });
    const wide = lastRatio()!; // the same page lying down is much less tall: more resolution is allowed
    expect(wide).toBeGreaterThan(tall);
  });
});
