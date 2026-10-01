/**
 * A PDF page carries its own /Rotate (a multiple of 90, usually set by scanners and phone-scanner
 * apps), and the reader's rotate button adds to it. react-pdf treats an explicit `rotate` as the
 * ABSOLUTE rotation and only falls back to the page's own value when none is given, so the two must
 * be combined here or the page's /Rotate is silently ignored (scans showed up sideways).
 */
export type RightAngle = 0 | 90 | 180 | 270;

export function normalizeRotation(degrees: number): RightAngle {
  const turns = Math.round((Number.isFinite(degrees) ? degrees : 0) / 90);
  return ((((turns % 4) + 4) % 4) * 90) as RightAngle;
}

/** The rotation the page is displayed at: its own /Rotate plus the one the user asked for. */
export function effectiveRotation(intrinsic: number | undefined, user: number): RightAngle {
  return normalizeRotation((intrinsic ?? 0) + user);
}

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A rect (0..1) measured on the page drawn at `rotation` (clockwise), mapped back onto the
 * UNROTATED page, the frame every stored rect uses. Exact inverse of
 * HighlightEngine.canonicalRectsToRendered, which draws stored rects at the displayed rotation.
 *
 * OCR reads a page the way a viewer shows it (a sideways scan is turned upright by its /Rotate) and
 * groups words into lines and sentences there, where text runs horizontally; only the finished
 * rects are mapped through this.
 */
export function rectToCanonical(rect: NormalizedBox, rotation: RightAngle): NormalizedBox {
  switch (rotation) {
    case 90:
      return { x: rect.y, y: 1 - (rect.x + rect.width), width: rect.height, height: rect.width };
    case 180:
      return { x: 1 - (rect.x + rect.width), y: 1 - (rect.y + rect.height), width: rect.width, height: rect.height };
    case 270:
      return { x: 1 - (rect.y + rect.height), y: rect.x, width: rect.height, height: rect.width };
    default:
      return rect;
  }
}
