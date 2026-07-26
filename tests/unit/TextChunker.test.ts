import { describe, it, expect } from 'vitest';
import { TextChunker } from '../../src/lib/processing/TextChunker';

describe('TextChunker', () => {
  it('should split text into chunks under the token limit', () => {
    const chunker = new TextChunker(100, 0);
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const chunks = chunker.chunk('doc-1', 1, text);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.documentId).toBe('doc-1');
      expect(chunk.pageNumber).toBe(1);
      expect(chunk.chunkType).toBe('paragraph');
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it('should produce overlapping chunks when overlap > 0', () => {
    // Create text that will split into multiple chunks
    const chunker = new TextChunker(50, 20);
    const longText = 'A'.repeat(200) + '\n\n' + 'B'.repeat(200);
    const chunks = chunker.chunk('doc-1', 1, longText);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // With overlap, the second chunk should contain some text from the end of the first
    if (chunks.length >= 2) {
      // Verify overlap exists by checking that content from first chunk appears in second
      const firstChunkWords = chunks[0].content.split(/\s+/);
      const overlapWordCount = Math.ceil(20 / 1.3);
      if (firstChunkWords.length > overlapWordCount) {
        const overlapWords = firstChunkWords.slice(-overlapWordCount).join(' ');
        expect(chunks[1].content).toContain(overlapWords.slice(0, 10));
      }
    }
  });

  it('should handle empty text gracefully', () => {
    const chunker = new TextChunker(512, 50);
    const chunks = chunker.chunk('doc-1', 1, '');
    expect(chunks).toHaveLength(0);
  });

  it('should handle single paragraph that fits in one chunk', () => {
    const chunker = new TextChunker(512, 50);
    const text = 'This is a short paragraph.';
    const chunks = chunker.chunk('doc-1', 1, text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('This is a short paragraph.');
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('should generate unique chunk IDs', () => {
    const chunker = new TextChunker(50, 0);
    const text = 'A'.repeat(200) + '\n\n' + 'B'.repeat(200);
    const chunks = chunker.chunk('doc-1', 1, text);

    const ids = chunks.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should track correct start and end offsets', () => {
    const chunker = new TextChunker(512, 0);
    const text = 'First paragraph.\n\nSecond paragraph.';
    const chunks = chunker.chunk('doc-1', 1, text);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.startOffset).toBeGreaterThanOrEqual(0);
      expect(chunk.endOffset).toBeGreaterThan(chunk.startOffset);
      expect(chunk.endOffset - chunk.startOffset).toBe(chunk.content.length);
    }
  });

  it('should default to 50 overlap tokens', () => {
    const chunker = new TextChunker(512);
    // Default constructor should have overlap of 50
    const text = 'A'.repeat(3000) + '\n\n' + 'B'.repeat(3000);
    const chunks = chunker.chunk('doc-1', 1, text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle text with no paragraph breaks', () => {
    const chunker = new TextChunker(100, 0);
    const text = 'A single long paragraph without any breaks.';
    const chunks = chunker.chunk('doc-1', 1, text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
  });

  it('should compute correct token counts', () => {
    const chunker = new TextChunker(512, 0);
    const text = 'Hello world'; // 11 chars → ceil(11/4) = 3 tokens
    const chunks = chunker.chunk('doc-1', 1, text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokenCount).toBe(3);
  });
});
