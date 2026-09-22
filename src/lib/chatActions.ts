import { extractPageReferenceRange } from './pageMapping';

export type HighlightActionScope = 'current_page' | 'page_range' | 'document';

export interface CreateHighlightsAction {
  type: 'create_highlights';
  instruction: string;
  scope: HighlightActionScope;
  page?: number;
  pages?: number[];
}

export type PageReferenceResolver = (label: string) => number | null;

const EXPLICIT_HIGHLIGHT = /^\s*(?:(?:por favor|please|s'il vous plaît|bitte|per favore)[,\s]+|(?:quiero que|podés|puedes|can you|could you|je veux que|peux-tu|pode|kannst du|puoi)\s+)?(?:subray(?:á|a|es|e|ar)|resalt(?:á|a|es|e|ar)|marc(?:á|a|as|ar)|destac(?:á|a|as|ar)|highlight|underline|mark|surligne|surligner|marque|marquer|destaque|destacar|sublinhe|sublinhar|markiere|markieren|evidenzia|evidenziare|sottolinea|sottolineare)(?=\s|$|[.,;:!?¿¡])/i;

const DOCUMENT_SCOPE = /(todo\s+el\s+documento|en\s+todo\s+el\s+documento|documento\s+completo|whole\s+document|entire\s+document|throughout\s+the\s+document|tout\s+le\s+document|document\s+entier|documento\s+inteiro|documento\s+todo|gesamte[nr]?\s+dokument|ganze[nr]?\s+dokument|intero\s+documento|tutto\s+il\s+documento)/i;

export function parseCreateHighlightsAction(
  userText: string,
  currentPage?: number,
  resolvePage?: PageReferenceResolver,
): CreateHighlightsAction | null {
  const text = userText.trim();
  if (!text || !EXPLICIT_HIGHLIGHT.test(text)) return null;

  if (DOCUMENT_SCOPE.test(text)) {
    return {
      type: 'create_highlights',
      instruction: text.slice(0, 1200),
      scope: 'document',
    };
  }

  const explicitRange = extractPageReferenceRange(text);
  if (explicitRange && resolvePage) {
    const start = resolvePage(explicitRange.startLabel);
    const end = resolvePage(explicitRange.endLabel ?? explicitRange.startLabel);
    if (start && end) {
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      if (to - from + 1 <= 80) {
        return {
          type: 'create_highlights',
          instruction: text.slice(0, 1200),
          scope: from === to ? 'current_page' : 'page_range',
          page: from === to ? from : undefined,
          pages: from === to
            ? undefined
            : Array.from({ length: to - from + 1 }, (_, index) => from + index),
        };
      }
    }
  }

  return {
    type: 'create_highlights',
    instruction: text.slice(0, 1200),
    scope: 'current_page',
    page: currentPage && currentPage > 0 ? currentPage : undefined,
  };
}
