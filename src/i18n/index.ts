import en from './en';
import es from './es';
import type { TranslationKey } from './en';

export type Language = 'en' | 'es';

const dictionaries: Record<Language, Record<TranslationKey, string>> = {
  en,
  es,
};

let currentLang: Language = (localStorage.getItem('lumena-lang') as Language) || 'en';

export function getLanguage(): Language {
  return currentLang;
}

export function setLanguage(lang: Language): void {
  currentLang = lang;
  localStorage.setItem('lumena-lang', lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
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
