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
