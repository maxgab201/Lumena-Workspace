/**
 * CitationEngine - Parse AI responses for citations
 *
 * Finds [Page X] references and creates clickable links.
 */

export interface Citation {
  pageNumber: number;
  text: string;
  highlightId?: string;
}

export class CitationEngine {
  static extractCitations(response: string): Citation[] {
    const citations: Citation[] = [];
    const pageRegex = /\[Page (\d+)\]/g;
    let match;

    while ((match = pageRegex.exec(response)) !== null) {
      citations.push({
        pageNumber: parseInt(match[1]),
        text: match[0],
      });
    }

    return citations;
  }

  static parseResponseWithCitations(response: string): {
    text: string;
    citations: Citation[];
  } {
    const citations = this.extractCitations(response);

    return {
      text: response,
      citations,
    };
  }
}
