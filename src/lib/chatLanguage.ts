export type ChatLanguage = 'es' | 'en' | 'fr' | 'pt' | 'de' | 'it';

const WORDS: Record<ChatLanguage, string[]> = {
  es: ['el','la','los','las','de','del','que','y','en','para','con','por','una','un','esta','este','es','son','se','su','sus','qué','como','cómo','explica','resumir'],
  en: ['the','of','and','to','in','for','with','this','that','what','how','is','are','from','on','as','explain','summarize','page','document'],
  fr: ['le','la','les','de','des','du','et','en','dans','pour','avec','ce','cette','ces','que','qui','quoi','comment','un','une','est','sont','au','aux','sur','résumer','page'],
  pt: ['o','a','os','as','de','do','da','e','em','para','com','esta','este','que','como','um','uma','é','são','no','na','resumir','página'],
  de: ['der','die','das','und','von','in','für','mit','diese','dieser','was','wie','ist','sind','auf','ein','eine','erkläre','seite','dokument'],
  it: ['il','lo','la','i','gli','le','di','del','della','e','in','per','con','questo','questa','che','come','un','una','è','sono','pagina','documento'],
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .match(/[a-zà-ÿáéíóúñüß]+/g) ?? [];
}

export function detectLanguage(text?: string | null): ChatLanguage | null {
  if (!text || text.trim().length < 4) return null;
  const tokens = words(text);
  if (tokens.length === 0) return null;

  const tokenLanguageCount = new Map<string, number>();
  for (const common of Object.values(WORDS)) {
    for (const token of new Set(common)) {
      tokenLanguageCount.set(token, (tokenLanguageCount.get(token) ?? 0) + 1);
    }
  }

  const scores = Object.entries(WORDS).map(([lang, common]) => {
    const set = new Set(common);
    let score = tokens.reduce((total, token) => {
      if (!set.has(token)) return total;
      const languageCount = tokenLanguageCount.get(token) ?? 1;
      return total + (languageCount === 1 ? 2 : 1 / languageCount);
    }, 0);

    // Only award strong bonuses for characters that are genuinely
    // discriminative. Plain "é" appears in several Romance languages.
    if (lang === 'es' && /[¿¡ñ]/i.test(text)) score += 2;
    if (lang === 'es' && /[áíóú]/i.test(text)) score += 1;
    if (lang === 'fr' && /[àâèêëîïôùûÿœ]/i.test(text)) score += 2;
    if (lang === 'pt' && /[ãõ]/i.test(text)) score += 2;
    if (lang === 'pt' && /ç/i.test(text)) score += 1;
    if (lang === 'de' && /[äöüß]/i.test(text)) score += 2;
    if (lang === 'it' && /\b(che|gli|della|questo|questa)\b/i.test(text)) score += 1;
    return [lang as ChatLanguage, score] as const;
  }).sort((a, b) => b[1] - a[1]);

  return scores[0][1] > 0 ? scores[0][0] : null;
}

export function languageFromLocale(locale?: string | null): ChatLanguage {
  const code = (locale ?? '').toLowerCase().split(/[-_]/)[0];
  return (['es','en','fr','pt','de','it'] as ChatLanguage[]).includes(code as ChatLanguage)
    ? code as ChatLanguage
    : 'en';
}

export function resolveChatLanguage(input: {
  recentUserMessages?: string[];
  currentPageText?: string | null;
  documentText?: string | null;
  locale?: string | null;
}): ChatLanguage {
  const recent = [...(input.recentUserMessages ?? [])].reverse();
  for (const message of recent) {
    const detected = detectLanguage(message);
    if (detected) return detected;
  }
  return detectLanguage(input.currentPageText)
    ?? detectLanguage(input.documentText)
    ?? languageFromLocale(input.locale);
}

type QuickAction = { label: string; prompt: string; testId: string };

const COPY: Record<ChatLanguage, {
  placeholder: string;
  selection: (page: number) => string;
  stop: string;
  actions: {
    summarize: QuickAction;
    explainSelection: QuickAction;
    explainHighlights: QuickAction;
    important: QuickAction;
    highlightImportant: QuickAction;
  };
}> = {
  es: {
    placeholder: 'Hacé una pregunta sobre el documento…',
    selection: (page) => `Selección (página ${page})`,
    stop: 'Detener generación',
    actions: {
      summarize: { label: 'Resumir esta página', prompt: 'Resumí esta página.', testId: 'chat-quick-page' },
      explainSelection: { label: 'Explicar selección', prompt: 'Explicame el texto seleccionado.', testId: 'chat-quick-explain-selection' },
      explainHighlights: { label: 'Explicar lo subrayado', prompt: 'Explicame lo que tengo subrayado en esta página.', testId: 'chat-quick-explain-highlights' },
      important: { label: '¿Qué es lo más importante?', prompt: '¿Qué es lo más importante de esta página?', testId: 'chat-quick-important' },
      highlightImportant: { label: 'Subrayar conceptos importantes', prompt: 'Subrayá los conceptos importantes de esta página.', testId: 'chat-quick-highlight' },
    },
  },
  en: {
    placeholder: 'Ask a question about the document…',
    selection: (page) => `Selection (page ${page})`,
    stop: 'Stop generating',
    actions: {
      summarize: { label: 'Summarize this page', prompt: 'Summarize this page.', testId: 'chat-quick-page' },
      explainSelection: { label: 'Explain selection', prompt: 'Explain the selected text.', testId: 'chat-quick-explain-selection' },
      explainHighlights: { label: 'Explain highlights', prompt: 'Explain what I highlighted on this page.', testId: 'chat-quick-explain-highlights' },
      important: { label: 'What is most important?', prompt: 'What is most important on this page?', testId: 'chat-quick-important' },
      highlightImportant: { label: 'Highlight key concepts', prompt: 'Highlight the important concepts on this page.', testId: 'chat-quick-highlight' },
    },
  },
  fr: {
    placeholder: 'Posez une question sur le document…',
    selection: (page) => `Sélection (page ${page})`,
    stop: 'Arrêter la génération',
    actions: {
      summarize: { label: 'Résumer cette page', prompt: 'Résume cette page.', testId: 'chat-quick-page' },
      explainSelection: { label: 'Expliquer la sélection', prompt: 'Explique le texte sélectionné.', testId: 'chat-quick-explain-selection' },
      explainHighlights: { label: 'Expliquer les surlignages', prompt: 'Explique ce que j’ai surligné sur cette page.', testId: 'chat-quick-explain-highlights' },
      important: { label: 'Le plus important ?', prompt: 'Qu’est-ce qui est le plus important sur cette page ?', testId: 'chat-quick-important' },
      highlightImportant: { label: 'Surligner les concepts clés', prompt: 'Surligne les concepts importants de cette page.', testId: 'chat-quick-highlight' },
    },
  },
  pt: {
    placeholder: 'Faça uma pergunta sobre o documento…',
    selection: (page) => `Seleção (página ${page})`,
    stop: 'Parar geração',
    actions: {
      summarize: { label: 'Resumir esta página', prompt: 'Resuma esta página.', testId: 'chat-quick-page' },
      explainSelection: { label: 'Explicar seleção', prompt: 'Explique o texto selecionado.', testId: 'chat-quick-explain-selection' },
      explainHighlights: { label: 'Explicar destaques', prompt: 'Explique o que destaquei nesta página.', testId: 'chat-quick-explain-highlights' },
      important: { label: 'O que é mais importante?', prompt: 'O que é mais importante nesta página?', testId: 'chat-quick-important' },
      highlightImportant: { label: 'Destacar conceitos importantes', prompt: 'Destaque os conceitos importantes desta página.', testId: 'chat-quick-highlight' },
    },
  },
  de: {
    placeholder: 'Stelle eine Frage zum Dokument…',
    selection: (page) => `Auswahl (Seite ${page})`,
    stop: 'Generierung stoppen',
    actions: {
      summarize: { label: 'Diese Seite zusammenfassen', prompt: 'Fasse diese Seite zusammen.', testId: 'chat-quick-page' },
      explainSelection: { label: 'Auswahl erklären', prompt: 'Erkläre den ausgewählten Text.', testId: 'chat-quick-explain-selection' },
      explainHighlights: { label: 'Markierungen erklären', prompt: 'Erkläre meine Markierungen auf dieser Seite.', testId: 'chat-quick-explain-highlights' },
      important: { label: 'Was ist am wichtigsten?', prompt: 'Was ist auf dieser Seite am wichtigsten?', testId: 'chat-quick-important' },
      highlightImportant: { label: 'Wichtige Konzepte markieren', prompt: 'Markiere die wichtigen Konzepte auf dieser Seite.', testId: 'chat-quick-highlight' },
    },
  },
  it: {
    placeholder: 'Fai una domanda sul documento…',
    selection: (page) => `Selezione (pagina ${page})`,
    stop: 'Interrompi generazione',
    actions: {
      summarize: { label: 'Riassumi questa pagina', prompt: 'Riassumi questa pagina.', testId: 'chat-quick-page' },
      explainSelection: { label: 'Spiega selezione', prompt: 'Spiega il testo selezionato.', testId: 'chat-quick-explain-selection' },
      explainHighlights: { label: 'Spiega evidenziazioni', prompt: 'Spiega ciò che ho evidenziato in questa pagina.', testId: 'chat-quick-explain-highlights' },
      important: { label: 'Cosa è più importante?', prompt: 'Cosa è più importante in questa pagina?', testId: 'chat-quick-important' },
      highlightImportant: { label: 'Evidenzia concetti importanti', prompt: 'Evidenzia i concetti importanti di questa pagina.', testId: 'chat-quick-highlight' },
    },
  },
};

export function chatCopy(language: ChatLanguage) {
  return COPY[language] ?? COPY.en;
}

export function quickActionsForLanguage(
  language: ChatLanguage,
  options: { hasSelection: boolean; hasHighlights: boolean },
): QuickAction[] {
  const actions = COPY[language]?.actions ?? COPY.en.actions;
  const result: QuickAction[] = [actions.summarize, actions.important];
  if (options.hasSelection) result.splice(1, 0, actions.explainSelection);
  if (options.hasHighlights) result.splice(options.hasSelection ? 2 : 1, 0, actions.explainHighlights);
  result.push(actions.highlightImportant);
  return result;
}

export function highlightActionResultText(
  language: ChatLanguage,
  created: number,
  scope: 'current_page' | 'document',
): string {
  const whole = scope === 'document';
  if (language === 'es') return created > 0
    ? `Listo. Creé ${created} subrayado${created === 1 ? '' : 's'} ${whole ? 'en el documento' : 'en esta página'} usando texto y geometría reales del PDF.`
    : `No encontré fragmentos verificables para subrayar ${whole ? 'en el documento' : 'en esta página'}.`;
  if (language === 'fr') return created > 0
    ? `Terminé. J’ai créé ${created} surlignage${created === 1 ? '' : 's'} ${whole ? 'dans le document' : 'sur cette page'} à partir du texte réel du PDF.`
    : `Je n’ai trouvé aucun fragment vérifiable à surligner ${whole ? 'dans le document' : 'sur cette page'}.`;
  if (language === 'pt') return created > 0
    ? `Pronto. Criei ${created} destaque${created === 1 ? '' : 's'} ${whole ? 'no documento' : 'nesta página'} usando o texto e a geometria reais do PDF.`
    : `Não encontrei trechos verificáveis para destacar ${whole ? 'no documento' : 'nesta página'}.`;
  if (language === 'de') return created > 0
    ? `Fertig. Ich habe ${created} Markierung${created === 1 ? '' : 'en'} ${whole ? 'im Dokument' : 'auf dieser Seite'} mit echter PDF-Geometrie erstellt.`
    : `Ich habe ${whole ? 'im Dokument' : 'auf dieser Seite'} keine überprüfbaren Textstellen zum Markieren gefunden.`;
  if (language === 'it') return created > 0
    ? `Fatto. Ho creato ${created} evidenziazione${created === 1 ? '' : 'i'} ${whole ? 'nel documento' : 'in questa pagina'} usando testo e geometria reali del PDF.`
    : `Non ho trovato frammenti verificabili da evidenziare ${whole ? 'nel documento' : 'in questa pagina'}.`;
  return created > 0
    ? `Done. I created ${created} highlight${created === 1 ? '' : 's'} ${whole ? 'in the document' : 'on this page'} using real PDF text and geometry.`
    : `I couldn't find any verifiable passages to highlight ${whole ? 'in the document' : 'on this page'}.`;
}
