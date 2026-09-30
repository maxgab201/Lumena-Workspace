import { describe, expect, it } from 'vitest';
import {
  extractPageReferenceRange,
  resolvePageRange,
  resolvePageReference,
} from '../../src/lib/pageMapping';
import { parseCreateHighlightsAction } from '../../src/lib/chatActions';

/**
 * Regression suite for page-reference extraction.
 *
 * The original pattern matched the letter "p" inside ordinary words
 * ("ex-pl-ain", "pi-ck", "pd-f") and captured a lone roman-numeral letter from
 * the word that follows "page"/"página" ("page in the middle" -> "i").
 * In a book with roman front matter that silently resolved to a real physical
 * page, so unrelated page text reached the model as "EXPLICITLY REQUESTED PAGES"
 * and chat-triggered highlights could land on the wrong page.
 */
describe('page reference extraction: no phantom pages from ordinary words', () => {
  it.each([
    'Please explain this paragraph',
    'Explícame el ejemplo de la página inicial',
    'What is on the page in the middle of the chapter?',
    'Resumí la página de arriba',
    'Pick the main ideas',
    'Give me a piece of advice about this',
    'Send the pdf summary',
    'Look at the homepage 5 times',
    'The page contains a table',
  ])('finds no page reference in %j', (text) => {
    expect(extractPageReferenceRange(text)).toBeNull();
  });

  it.each([
    ['explícame las páginas 50 a 55', { startLabel: '50', endLabel: '55' }],
    ['subrayá las definiciones de las páginas 3 a 7', { startLabel: '3', endLabel: '7' }],
    ['what is on page iv?', { startLabel: 'iv' }],
    ['summarize pages iv-vii', { startLabel: 'iv', endLabel: 'vii' }],
    ['Analizá las páginas 2-4 y comparalas.', { startLabel: '2', endLabel: '4' }],
    ['resumen de la pág. 12', { startLabel: '12' }],
    ['see p. 12', { startLabel: '12' }],
    ['see pp. 12-14', { startLabel: '12', endLabel: '14' }],
    ['página 63', { startLabel: '63' }],
    ['Page: 7', { startLabel: '7' }],
    ['(page 5)', { startLabel: '5' }],
    ['¿qué dice la página 9?', { startLabel: '9' }],
  ])('still extracts a genuine reference from %j', (text, expected) => {
    expect(extractPageReferenceRange(text)).toEqual(expected);
  });

  it('does not resolve a phantom roman page in a book with roman front matter', () => {
    const labels = ['i', 'ii', 'iii', 'iv', 'v', '1', '2', '3'];
    const range = extractPageReferenceRange('Resumí la página inicial del capítulo');
    expect(range === null ? null : resolvePageRange(labels, range, 25)).toBeNull();
  });
});

describe('chat-triggered highlight actions ignore phantom pages', () => {
  const labels = ['i', 'ii', 'iii', 'iv', 'v', '1', '2', '3'];
  const resolve = (label: string) => resolvePageReference(labels, label);

  it('keeps the current page when the command contains no genuine page reference', () => {
    // "pista" used to yield the phantom reference "i" -> physical page 1.
    const action = parseCreateHighlightsAction('subrayá la pista más importante', 7, resolve);
    expect(action).toMatchObject({ scope: 'current_page', page: 7 });
    expect(action?.pages).toBeUndefined();
  });

  it('still honours a genuine logical reference (current page differs from the target)', () => {
    // logical "2" is physical page 7; the reader is on physical page 1.
    const action = parseCreateHighlightsAction('subrayá las definiciones de la página 2', 1, resolve);
    expect(action).toMatchObject({ scope: 'current_page', page: 7 });
  });
});
