/**
 * How much canvas the reader may spend on a page.
 *
 * react-pdf draws a page at `width × devicePixelRatio` with no upper bound. At the maximum zoom (500%) a page is
 * about 40 million pixels on a normal screen and four times that on a 2x one, 4 bytes each, and the list keeps
 * the visible pages plus its overscan mounted. Measured in a real browser on a 900-page document: at 500% zoom
 * twelve canvases held 409 million pixels and the browser used 3.1 GB (0.9 GB again after zooming out). Safari on
 * iOS goes further and draws nothing at all on a canvas above about 16.7 million pixels.
 *
 * pdf.js bounds both in the same way: a pixel cap per canvas (its `maxCanvasPixels`, 2^25 by default) that lowers
 * the render resolution only when it is needed, and few pages around the visible ones when pages are large.
 */

/** pdf.js's default `maxCanvasPixels`. */
export const MAX_CANVAS_PIXELS = 33_554_432;
/** What iOS Safari can draw on one canvas (2^24); above it the canvas stays blank. */
export const MAX_CANVAS_PIXELS_IOS = 16_777_216;

const MIN_PIXEL_RATIO = 0.25;

export function isIosLike(userAgent: string, maxTouchPoints: number): boolean {
  // iPadOS reports itself as a Mac, with a touch screen.
  return /iP(hone|ad|od)/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function maxCanvasPixelsFor(userAgent: string, maxTouchPoints: number): number {
  return isIosLike(userAgent, maxTouchPoints) ? MAX_CANVAS_PIXELS_IOS : MAX_CANVAS_PIXELS;
}

/**
 * The pixel ratio to draw a page of `cssWidth × cssHeight` at: the screen's own, lowered just enough to keep the
 * canvas within `maxPixels`. Never raised above the screen's ratio, and never below a floor that keeps it readable.
 */
export function pagePixelRatio(cssWidth: number, cssHeight: number, deviceRatio: number, maxPixels: number = MAX_CANVAS_PIXELS): number {
  const ratio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const area = cssWidth * cssHeight;
  if (!(area > 0)) return ratio;
  const allowed = Math.sqrt(maxPixels / area);
  return Math.max(MIN_PIXEL_RATIO, Math.min(ratio, allowed));
}

/** Pages kept mounted above and below the visible ones: generous when pages are small, minimal when they are huge. */
export function overscanForScale(scale: number): number {
  if (scale <= 1.5) return 5;
  if (scale <= 2.5) return 2;
  return 1;
}
