/**
 * TextChunker - Splits document text into meaningful chunks
 *
 * Uses semantic chunking with token awareness and configurable overlap.
 * Each chunk maintains metadata for溯源.
 */

export interface TextChunk {
  id: string;
  documentId: string;
  pageNumber: number;
  content: string;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
  chunkType: 'paragraph' | 'section' | 'table' | 'figure';
}

export class TextChunker {
  private maxTokensPerChunk: number;
  private overlapTokens: number;

  constructor(maxTokens: number = 512, overlap: number = 50) {
    this.maxTokensPerChunk = maxTokens;
    this.overlapTokens = overlap;
  }

  chunk(documentId: string, pageNumber: number, text: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    const paragraphs = this.splitIntoParagraphs(text);

    let currentChunk = '';
    let startOffset = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const candidate = currentChunk ? currentChunk + ' ' + paragraph : paragraph;

      if (this.estimateTokens(candidate) > this.maxTokensPerChunk) {
        // Flush current chunk if it has content
        if (currentChunk) {
          chunks.push(this.createChunk(documentId, pageNumber, currentChunk, startOffset, chunkIndex));
          chunkIndex++;

          // Compute overlap: take the last N tokens worth of text from the current chunk
          const overlapText = this.extractOverlapText(currentChunk);
          startOffset += currentChunk.length - overlapText.length + 1; // +1 for the space separator
          currentChunk = overlapText ? overlapText + ' ' + paragraph : paragraph;
        } else {
          // Single paragraph exceeds max tokens — emit it as-is (cannot split further at paragraph level)
          chunks.push(this.createChunk(documentId, pageNumber, paragraph, startOffset, chunkIndex));
          chunkIndex++;
          startOffset += paragraph.length + 1;
          currentChunk = '';
        }
      } else {
        currentChunk = candidate;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(documentId, pageNumber, currentChunk, startOffset, chunkIndex));
    }

    return chunks;
  }

  private createChunk(
    documentId: string,
    pageNumber: number,
    content: string,
    startOffset: number,
    chunkIndex: number,
  ): TextChunk {
    const trimmed = content.trim();
    return {
      id: `${documentId}_p${pageNumber}_c${chunkIndex}`,
      documentId,
      pageNumber,
      content: trimmed,
      tokenCount: this.estimateTokens(trimmed),
      startOffset,
      endOffset: startOffset + trimmed.length,
      chunkType: 'paragraph',
    };
  }

  /**
   * Extract the last `overlapTokens` worth of text from a chunk.
   * Uses word boundaries to avoid splitting mid-word.
   */
  private extractOverlapText(text: string): string {
    if (this.overlapTokens <= 0) return '';

    const words = text.split(/\s+/);
    // Estimate tokens from word count (rough: ~1.3 tokens per word for English)
    const estimatedTokensPerWord = 1.3;
    const overlapWordCount = Math.ceil(this.overlapTokens / estimatedTokensPerWord);

    if (words.length <= overlapWordCount) return text;

    return words.slice(-overlapWordCount).join(' ');
  }

  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }
}
