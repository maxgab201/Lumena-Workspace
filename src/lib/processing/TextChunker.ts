/**
 * TextChunker - Splits document text into meaningful chunks
 *
 * Uses semantic chunking with token awareness.
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

  constructor(maxTokens: number = 512, _overlap: number = 50) {
    this.maxTokensPerChunk = maxTokens;
  }

  chunk(documentId: string, pageNumber: number, text: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    const paragraphs = this.splitIntoParagraphs(text);

    let currentChunk = '';
    let startOffset = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      if (this.estimateTokens(currentChunk + ' ' + paragraph) > this.maxTokensPerChunk) {
        if (currentChunk) {
          chunks.push({
            id: `${documentId}_p${pageNumber}_c${chunkIndex}`,
            documentId,
            pageNumber,
            content: currentChunk.trim(),
            tokenCount: this.estimateTokens(currentChunk),
            startOffset,
            endOffset: startOffset + currentChunk.length,
            chunkType: 'paragraph',
          });
          chunkIndex++;
        }
        startOffset += currentChunk.length + 1;
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + paragraph;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: `${documentId}_p${pageNumber}_c${chunkIndex}`,
        documentId,
        pageNumber,
        content: currentChunk.trim(),
        tokenCount: this.estimateTokens(currentChunk),
        startOffset,
        endOffset: startOffset + currentChunk.length,
        chunkType: 'paragraph',
      });
    }

    return chunks;
  }

  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}
