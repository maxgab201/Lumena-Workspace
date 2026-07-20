import { useState, useEffect } from 'react';
import { getLanguage, type Language } from '../i18n';

export function useLanguage(): Language {
  const [lang, setLang] = useState<Language>(getLanguage);

  useEffect(() => {
    const handler = () => setLang(getLanguage());
    window.addEventListener('languagechange', handler);
    return () => window.removeEventListener('languagechange', handler);
  }, []);

  return lang;
}
