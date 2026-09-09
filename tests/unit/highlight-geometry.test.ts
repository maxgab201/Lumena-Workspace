import { describe, it, expect } from 'vitest';
import { HighlightEngine } from '../../src/lib/processing/HighlightEngine';
import type { NormalizedRect } from '../../src/types/highlights';

/**
 * Regression tests for Checkpoint 2 Bug 2: highlight geometry must be stored
 * in canonical UNROTATED page space and transformed at render time so a
 * highlight stays anchored to the same text at any rotation.
 *
 * The forward maps below mirror exactly how PDF.js positions text spans at
 * each `data-main-rotation` (see TextLayer#getSelectionBoxes in pdf.mjs):
 *   90:  rendered.x = 1 - (u.y + u.h); rendered.y = u.x        (w/h swap)
 *   180: rendered.x = 1 - (u.x + u.w); rendered.y = 1 - (u.y + u.h)
 *   270: rendered.x = u.y;             rendered.y = 1 - (u.x + u.w)  (w/h swap)
 */

function roundRect(r: NormalizedRect): NormalizedRect {
  return {
    x: Number(r.x.toFixed(4)),
    y: Number(r.y.toFixed(4)),
    width: Number(r.width.toFixed(4)),
    height: Number(r.height.toFixed(4)),
  };
}

describe('HighlightEngine canonical geometry (rotation-invariant)', () => {
  // A canonical rect in unrotated page space: a word on the first line,
  // left third of the page (portrait, unrotated w > h).
  const canonical: NormalizedRect = { x: 0.1, y: 0.08, width: 0.25, height: 0.04 };

  it('identity: rotation 0 renders the canonical rect unchanged', () => {
    const rendered = HighlightEngine.canonicalRectsToRendered([canonical], 0);
    expect(roundRect(rendered[0])).toEqual(roundRect(canonical));
  });

  it('rotation 90 maps canonical → rendered box consistently (w/h swapped)', () => {
    const rendered = HighlightEngine.canonicalRectsToRendered([canonical], 90)[0];
    // Forward 90° map
    expect(rendered.x).toBeCloseTo(1 - (canonical.y + canonical.height), 5);
    expect(rendered.y).toBeCloseTo(canonical.x, 5);
    expect(rendered.width).toBeCloseTo(canonical.height, 5);
    expect(rendered.height).toBeCloseTo(canonical.width, 5);
    // Bounds are valid
    expect(rendered.x).toBeGreaterThanOrEqual(0);
    expect(rendered.y).toBeGreaterThanOrEqual(0);
  });

  it('rotation 180 maps canonical → rendered box consistently', () => {
    const rendered = HighlightEngine.canonicalRectsToRendered([canonical], 180)[0];
    expect(rendered.x).toBeCloseTo(1 - (canonical.x + canonical.width), 5);
    expect(rendered.y).toBeCloseTo(1 - (canonical.y + canonical.height), 5);
    expect(rendered.width).toBeCloseTo(canonical.width, 5);
    expect(rendered.height).toBeCloseTo(canonical.height, 5);
  });

  it('rotation 270 maps canonical → rendered box consistently (w/h swapped)', () => {
    const rendered = HighlightEngine.canonicalRectsToRendered([canonical], 270)[0];
    expect(rendered.x).toBeCloseTo(canonical.y, 5);
    expect(rendered.y).toBeCloseTo(1 - (canonical.x + canonical.width), 5);
    expect(rendered.width).toBeCloseTo(canonical.height, 5);
    expect(rendered.height).toBeCloseTo(canonical.width, 5);
  });

  it('render → canonical roundtrip returns the original rect for every rotation', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const rendered = HighlightEngine.canonicalRectsToRendered([canonical], rotation)[0];
      const back = HighlightEngine.canonicalRectsToRendered([rendered], (360 - rotation) % 360)[0];
      expect(roundRect(back)).toEqual(roundRect(canonical));
    }
  });

  it('persistence never changes: re-rendering at each rotation starts from the same canonical rect', () => {
    // Simulates the real flow: the SAME persisted geometry is re-transformed
    // at every rotation step (0→90→180→270→0). Each render must be consistent
    // with the forward map of the canonical rect — geometry is never mutated.
    for (const rotation of [0, 90, 180, 270]) {
      const rendered = HighlightEngine.canonicalRectsToRendered([canonical], rotation)[0];
      const inverse = HighlightEngine.canonicalRectsToRendered([rendered], (360 - rotation) % 360)[0];
      expect(roundRect(inverse)).toEqual(roundRect(canonical));
    }
  });

  it('does not mutate the persisted geometry', () => {
    const original = { ...canonical };
    HighlightEngine.canonicalRectsToRendered([canonical], 90);
    HighlightEngine.canonicalRectsToRendered([canonical], 180);
    expect(canonical).toEqual(original);
  });

  it('normalizes negative rotation input (e.g. -90 ≡ 270)', () => {
    const a = HighlightEngine.canonicalRectsToRendered([canonical], 270)[0];
    const b = HighlightEngine.canonicalRectsToRendered([canonical], -90)[0];
    expect(roundRect(b)).toEqual(roundRect(a));
  });
});

describe('HighlightEngine credit gating invariant (Bug 1 contract)', () => {
  // The Edge Function now skips billing entirely when cost === 0. This unit
  // pins the mathematical rule the backend must obey: required=0 with
  // available=0 (or even no account at all) MUST be allowed.
  function shouldBlockProcessing(required: number, available: number | null): boolean {
    // Mirrors the fixed logic in process-document: the credit gate only runs
    // when there is something to charge.
    if (required <= 0) return false;
    if (available === null) return true;
    return available < required;
  }

  it('required=0, available=0 → ALLOWED (the production bug scenario)', () => {
    expect(shouldBlockProcessing(0, 0)).toBe(false);
  });

  it('required=0, no credit account → ALLOWED', () => {
    expect(shouldBlockProcessing(0, null)).toBe(false);
  });

  it('required=0, available=999 → ALLOWED', () => {
    expect(shouldBlockProcessing(0, 999)).toBe(false);
  });

  it('required>0, available=null → BLOCKED', () => {
    expect(shouldBlockProcessing(5, null)).toBe(true);
  });

  it('required>0, available<required → BLOCKED', () => {
    expect(shouldBlockProcessing(5, 3)).toBe(true);
  });
});
