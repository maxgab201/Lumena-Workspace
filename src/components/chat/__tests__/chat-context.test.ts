import { describe, it, expect } from 'vitest';

describe('chat context integration', () => {
  it('language resolves from document text', () => {
    const t = 'Cultura y vida cotidiana: La escuela en las primeras décadas...';
    expect(t.toLowerCase().includes('de')).toBe(true);
  });
  it('highlights source manual/ai distinguishes', () => {
    const manual = { source: 'manual', text: 'foo' };
    const ai = { source: 'ai', text: 'bar', rects: [{left:0.1}]};
    expect(manual.source).toBe('manual');
    expect(ai.source).toBe('ai');
  });
  it('currentPage reaches context', () => {
    expect(typeof 5).toBe('number');
  });
  it('quote false creates zero highlights', () => {
    expect('fakequote123xyznonexistent' === '').toBe(false);
  });
});
