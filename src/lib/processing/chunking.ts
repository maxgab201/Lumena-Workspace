/**
 * Text Chunking Utility
 *
 * Splits text into overlapping chunks respecting token limits and semantic boundaries.
 * Preserves page references and maintains context overlap.
 */

export interface ChunkOptions {
  maxTokens: number;
  overlapTokens: number;
}

export interface TextChunk {
  text: string;
  tokenCount: number;
  startIndex: number;
  endIndex: number;
  pageNumber?: number;
  sectionTitle?: string;
}

/**
 * Split text into chunks respecting token limits and semantic boundaries
 */
export function chunkText(
  text: string,
  options: { maxTokens?: number; overlapTokens?: number } = {}
): { text: string; tokenCount: number; startIndex: number; endIndex: number }[] {
  const maxTokens = options.maxTokens || 512;
  const overlapTokens = options.overlapTokens || 50;

  const chunks: { text: string; tokenCount: number; startIndex: number; endIndex: number }[] = [];

  // Split by sentences first (respecting semantic boundaries)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  let currentChunk = '';
  let currentTokens = 0;
  let currentStartIndex = 0;

  for (const sentence of sentences) {
    const sentenceText = sentence.trim() + '. ';
    const sentenceTokens = Math.ceil(sentenceText.length / 4);

    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      // Push current chunk
      chunks.push({
        text: currentChunk.trim(),
        tokenCount: currentTokens,
        startIndex: currentStartIndex,
        endIndex: currentStartIndex + currentChunk.length,
      });

      // Start new chunk with overlap
      const overlapStart = Math.max(0, currentChunk.length - overlapTokens * 4);
      currentChunk = currentChunk.substring(overlapStart) + sentenceText + '. ';
      currentTokens = Math.ceil(currentChunk.length / 4);
      currentStartIndex += currentChunk.length - sentenceText.length - 2; // Adjust for overlap
    } else {
      currentChunk += sentenceText + ' ';
      currentTokens += sentenceTokens;
    }
  }

  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      tokenCount: currentTokens,
      startIndex: currentStartIndex,
      endIndex: currentStartIndex + currentChunk.length,
    });
  }

  return chunks;
}

// Also export a simpler version for simpler use cases
export function chunkTextSimple(
  text: string,
  maxTokens: number = 512,
  overlapTokens: number = 50
): string[] {
  const chunks = chunkText(text, { maxTokens, overlapTokens });
  return chunks.map(c => c.text);
}

/**
 * Chunk text by pages (for documents with page markers)
 */
export function chunkByPages(
  text: string,
  pageMarkers: string[] = ['---PAGE---', '\f', '\n\n\n']
): { text: string; pageNumber: number; tokenCount: number }[] {
  const regex = new RegExp(`(${pageMarkers.join('|')})`);
  const pages = text.split(regex)
    .filter(part => part.trim().length > 0 && !pageMarkers.includes(part));

  return pages.map((pageText, index) => ({
    text: pageText.trim(),
    pageNumber: index + 1,
    tokenCount: Math.ceil(pageText.length / 4),
  }));
}

/**
 * Extract page number from text using common page markers
 */
export function extractPageNumber(text: string, defaultPage = 1): number {
  // Common patterns: "Page X", "Page X of Y", "X/Y", etc.
  const patterns = [
    /page\s+(\d+)/gi,
    /página\s+(\d+)/gi,
    /^(\d+)\s*$/m, // Standalone number on line
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }
  return defaultPage;
}