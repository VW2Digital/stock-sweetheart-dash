import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES, normalizeLng, type SupportedLanguage } from '@/i18n';

export type Language = SupportedLanguage;

interface LanguageInfo {
  code: Language;
  flag: string;
  short: string;
  label: string;
}

export const languages: LanguageInfo[] = [
  { code: 'pt-PT', flag: 'pt', short: 'PT', label: 'Português' },
  { code: 'es', flag: 'es', short: 'ES', label: 'Español' },
  { code: 'en', flag: 'gb', short: 'EN', label: 'English' },
];

const SUPPORTED: readonly Language[] = SUPPORTED_LANGUAGES;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  refreshSeoTags: () => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const normalize = (raw: string | undefined): Language => normalizeLng(raw);

/**
 * Adaptador de compatibilidade sobre o i18next.
 * Mantém a API legada `useLanguage()` para não partir os componentes existentes.
 * Toda a tradução, deteção, persistência e fallback é feita pelo i18next.
 */
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { t: i18nT, i18n: i18nInstance } = useTranslation();
  const [lang, setLangState] = useState<Language>(() => normalize(i18nInstance.language));
  const [, setSeoTick] = useState(0);
  const refreshSeoTags = useCallback(() => setSeoTick((n) => n + 1), []);

  // Mantém o estado React em sincronia com mudanças do i18next (incluindo entre abas)
  useEffect(() => {
    const onChange = (lng: string) => setLangState(normalize(lng));
    i18nInstance.on('languageChanged', onChange);
    return () => { i18nInstance.off('languageChanged', onChange); };
  }, [i18nInstance]);

  const setLang = useCallback((l: Language) => {
    if (!SUPPORTED.includes(l)) return;
    i18nInstance.changeLanguage(l);
  }, [i18nInstance]);

  // <html lang> + <link rel="alternate" hreflang> para SEO
  useEffect(() => {
    const htmlLangMap: Record<Language, string> = {
      'pt-PT': 'pt-PT',
      es: 'es',
      en: 'en',
    };
    document.documentElement.lang = htmlLangMap[lang];

    const head = document.head;
    head.querySelectorAll('link[data-i18n="hreflang"]').forEach((el) => el.remove());

    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const alternates: Array<{ hreflang: string; lang: Language }> = [
      { hreflang: 'pt-PT', lang: 'pt-PT' },
      { hreflang: 'es', lang: 'es' },
      { hreflang: 'en', lang: 'en' },
    ];
    alternates.forEach(({ hreflang, lang: l }) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hreflang;
      link.href = `${baseUrl}?lang=${l}`;
      link.setAttribute('data-i18n', 'hreflang');
      head.appendChild(link);
    });
    const xDefault = document.createElement('link');
    xDefault.rel = 'alternate';
    xDefault.hreflang = 'x-default';
    xDefault.href = baseUrl;
    xDefault.setAttribute('data-i18n', 'hreflang');
    head.appendChild(xDefault);
  }, [lang]);

  const t = useCallback(
    (key: string, options?: Record<string, unknown>): string =>
      i18nT(key, options as any) as string,
    [i18nT, lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, refreshSeoTags }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
};

// Re-export para conveniência
export { i18n };
