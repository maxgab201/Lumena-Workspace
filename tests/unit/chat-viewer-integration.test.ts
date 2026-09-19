import { describe, expect, it } from 'vitest';
import {
  quickActionsForLanguage,
  resolveChatLanguage,
} from '../../src/lib/chatLanguage';
import { parseCreateHighlightsAction } from '../../src/lib/chatActions';
import {
  matchQuote,
  rectsForWordRange,
  type Sentence,
} from '../../src/lib/ai/SentenceInventory';

describe('Chat ↔ Viewer ↔ AI Highlight integration helpers', () => {
  it('prioritizes recent user language over the page language', () => {
    expect(resolveChatLanguage({
      recentUserMessages: ['¿Me explicás esto de forma simple?'],
      currentPageText: 'Photosynthesis converts light energy into chemical energy.',
      locale: 'en-US',
    })).toBe('es');
  });

  it('falls back to current page language when user history is empty', () => {
    expect(resolveChatLanguage({
      recentUserMessages: [],
      currentPageText: 'La photosynthèse permet aux plantes de convertir la lumière en énergie.',
      locale: 'en-US',
    })).toBe('fr');
  });

  it('builds Spanish contextual actions for selection and highlights', () => {
    const actions = quickActionsForLanguage('es', { hasSelection: true, hasHighlights: true });
    expect(actions.map((action) => action.label)).toContain('Explicar selección');
    expect(actions.map((action) => action.label)).toContain('Explicar lo subrayado');
    expect(actions.map((action) => action.prompt)).toContain('Subrayá los conceptos importantes de esta página.');
  });

  it('parses an explicit current-page highlight command', () => {
    expect(parseCreateHighlightsAction('Subrayá las definiciones de esta página.', 7)).toEqual({
      type: 'create_highlights',
      instruction: 'Subrayá las definiciones de esta página.',
      scope: 'current_page',
      page: 7,
    });
  });

  it('does not turn non-highlight text into an action', () => {
    expect(parseCreateHighlightsAction('Explicame esta página.', 7)).toBeNull();
  });

  it('detects whole-document highlight scope', () => {
    const action = parseCreateHighlightsAction(
      'Subrayá todo lo relacionado con OpenClaw en todo el documento.',
      3,
    );
    expect(action?.scope).toBe('document');
    expect(action?.page).toBeUndefined();
  });

  it('maps a verified quote to real word geometry and rejects invented text', () => {
    const sentence: Sentence = {
      sentence_key: 'p1-S0',
      page_number: 1,
      text: 'Plants convert light energy into chemical energy',
      words: [
        { text: 'Plants', rect: { x: 0.10, y: 0.20, width: 0.08, height: 0.03 }, lineIndex: 0 },
        { text: 'convert', rect: { x: 0.19, y: 0.20, width: 0.09, height: 0.03 }, lineIndex: 0 },
        { text: 'light', rect: { x: 0.29, y: 0.20, width: 0.06, height: 0.03 }, lineIndex: 0 },
        { text: 'energy', rect: { x: 0.36, y: 0.20, width: 0.08, height: 0.03 }, lineIndex: 0 },
        { text: 'into', rect: { x: 0.10, y: 0.25, width: 0.05, height: 0.03 }, lineIndex: 1 },
        { text: 'chemical', rect: { x: 0.16, y: 0.25, width: 0.10, height: 0.03 }, lineIndex: 1 },
        { text: 'energy', rect: { x: 0.27, y: 0.25, width: 0.08, height: 0.03 }, lineIndex: 1 },
      ],
    };

    const match = matchQuote(sentence, 'convert light energy into chemical energy');
    expect(match).not.toBeNull();
    const rects = rectsForWordRange(sentence.words, match!.startWord, match!.endWord);
    expect(rects).toHaveLength(2);
    expect(rects.every((rect) => rect.width > 0 && rect.height > 0)).toBe(true);
    expect(matchQuote(sentence, 'invented text that is not in the PDF')).toBeNull();
  });
});
