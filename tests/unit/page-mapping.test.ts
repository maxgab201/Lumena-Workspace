import { describe, expect, it } from 'vitest';
import {
  applyPageLabelOverrides,
  buildSequentialOverrides,
  extractPageReferenceRange,
  normalizePdfLabels,
  resolvePageRange,
  resolvePageReference,
} from '../../src/lib/pageMapping';
import { parseCreateHighlightsAction } from '../../src/lib/chatActions';

describe('logical page mapping', () => {
  it('uses PDF page labels when present and keeps roman front matter', () => {
    const labels = normalizePdfLabels(6, ['i', 'ii', '1', '2', '3', '4']);
    expect(resolvePageReference(labels, 'ii')).toBe(2);
    expect(resolvePageReference(labels, '1')).toBe(3);
    expect(resolvePageReference(labels, '4')).toBe(6);
  });

  it('falls back to physical page numbers when no logical label matches', () => {
    const labels = ['i', 'ii', '1', '2'];
    expect(resolvePageReference(labels, '4')).toBe(4);
  });

  it('applies manual corrections without mutating the native mapping', () => {
    const base = ['1', '2', '3', '4'];
    const mapped = applyPageLabelOverrides(base, { 2: '50', 3: '51' });
    expect(mapped).toEqual(['1', '50', '51', '4']);
    expect(base).toEqual(['1', '2', '3', '4']);
  });

  it('continues numeric and roman sequences from a corrected physical page', () => {
    expect(buildSequentialOverrides(3, '50', 6)).toEqual({
      3: '50', 4: '51', 5: '52', 6: '53',
    });
    expect(buildSequentialOverrides(2, 'iv', 5)).toEqual({
      2: 'iv', 3: 'v', 4: 'vi', 5: 'vii',
    });
  });

  it('extracts and resolves logical page ranges', () => {
    const labels = ['i', 'ii', '1', '2', '3', '4', '5'];
    const ref = extractPageReferenceRange('Analizá las páginas 2-4 y comparalas.');
    expect(ref).toEqual({ startLabel: '2', endLabel: '4' });
    expect(resolvePageRange(labels, ref!)).toEqual({
      startPage: 4,
      endPage: 6,
      pages: [4, 5, 6],
    });
  });

  it('maps explicit AI highlight ranges through logical labels', () => {
    const labels = ['i', 'ii', '1', '2', '3', '4', '5'];
    const action = parseCreateHighlightsAction(
      'Subrayá las definiciones de las páginas 2-4.',
      1,
      (label) => resolvePageReference(labels, label),
    );

    expect(action).toEqual({
      type: 'create_highlights',
      instruction: 'Subrayá las definiciones de las páginas 2-4.',
      scope: 'page_range',
      pages: [4, 5, 6],
    });
  });
});
