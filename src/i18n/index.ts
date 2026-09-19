import en from './en';
import es from './es';
import type { TranslationKey } from './en';

export type Language = 'en' | 'es';

const dictionaries: Record<Language, Record<TranslationKey, string>> = {
  en,
  es,
};

function detectInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';

  const stored = window.localStorage.getItem('lumena-lang');
  if (stored === 'en' || stored === 'es') return stored;

  return window.navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let currentLang: Language = detectInitialLanguage();
if (typeof document !== 'undefined') {
  document.documentElement.lang = currentLang;
}

export function getLanguage(): Language {
  return currentLang;
}

export function setLanguage(lang: Language): void {
  currentLang = lang;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('lumena-lang', lang);
    window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = dictionaries[currentLang] || dictionaries.en;
  let value = dict[key] || dictionaries.en[key] || key;

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }

  return value;
}

export type { TranslationKey };
