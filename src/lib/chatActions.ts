export type HighlightActionScope = 'current_page' | 'document';

export interface CreateHighlightsAction {
  type: 'create_highlights';
  instruction: string;
  scope: HighlightActionScope;
  page?: number;
}

const EXPLICIT_HIGHLIGHT = /^\s*(?:(?:por favor|please|s'il vous plaît|por favor|bitte|per favore)[,\s]+|(?:quiero que|podés|puedes|can you|could you|je veux que|peux-tu|pode|kannst du|puoi)\s+)?(?:subray(?:á|a|es|e|ar)|resalt(?:á|a|es|e|ar)|marc(?:á|a|as|ar)|destac(?:á|a|as|ar)|highlight|underline|mark|surligne|surligner|marque|marquer|destaque|destacar|sublinhe|sublinhar|markiere|markieren|evidenzia|evidenziare|sottolinea|sottolineare)\b/i;

const DOCUMENT_SCOPE = /(todo\s+el\s+documento|en\s+todo\s+el\s+documento|documento\s+completo|whole\s+document|entire\s+document|throughout\s+the\s+document|tout\s+le\s+document|document\s+entier|documento\s+inteiro|documento\s+todo|gesamte[nr]?\s+dokument|ganze[nr]?\s+dokument|intero\s+documento|tutto\s+il\s+documento)/i;

export function parseCreateHighlightsAction(
  userText: string,
  currentPage?: number,
): CreateHighlightsAction | null {
  const text = userText.trim();
  if (!text || !EXPLICIT_HIGHLIGHT.test(text)) return null;

  const scope: HighlightActionScope = DOCUMENT_SCOPE.test(text) ? 'document' : 'current_page';
  return {
    type: 'create_highlights',
    instruction: text.slice(0, 1200),
    scope,
    page: scope === 'current_page' && currentPage && currentPage > 0 ? currentPage : undefined,
  };
}
