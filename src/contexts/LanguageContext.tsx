import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES, normalizeLng, type SupportedLanguage } from '@/i18n';
import { useLanguageSettings } from '@/hooks/useLanguageSettings';

export type Language = SupportedLanguage;

interface LanguageInfo {
  code: Language;
  flag: string;
  short: string;
  label: string;
}

export const languages: LanguageInfo[] = [
  { code: 'es', flag: 'es', short: 'ES', label: 'Español' },
  { code: 'en', flag: 'gb', short: 'EN', label: 'English' },
  { code: 'pt', flag: 'pt', short: 'PT', label: 'Português (PT)' },
  { code: 'pt-BR', flag: 'br', short: 'BR', label: 'Português (BR)' },
];

const SUPPORTED: readonly Language[] = SUPPORTED_LANGUAGES;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  refreshSeoTags: () => void;
  enabledLanguages: Language[];
  availableLanguages: LanguageInfo[];
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
  const settings = useLanguageSettings();

  // Mantém o estado React em sincronia com mudanças do i18next (incluindo entre abas)
  useEffect(() => {
    const onChange = (lng: string) => setLangState(normalize(lng));
    i18nInstance.on('languageChanged', onChange);
    return () => { i18nInstance.off('languageChanged', onChange); };
  }, [i18nInstance]);

  // Aplica idioma padrão / habilitado das configurações administrativas.
  useEffect(() => {
    if (settings.loading) return;
    const hasUrlLang = new URLSearchParams(window.location.search).has('lang');
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('language') : null;
    const current = normalize(i18nInstance.language);
    // Se o idioma atual não está habilitado, força para o padrão.
    if (!settings.enabled.includes(current)) {
      i18nInstance.changeLanguage(settings.defaultLang);
      return;
    }
    // Se nunca houve escolha (sem ?lang= e sem localStorage), aplica padrão.
    if (!hasUrlLang && !stored && current !== settings.defaultLang) {
      i18nInstance.changeLanguage(settings.defaultLang);
    }
  }, [settings.loading, settings.enabled, settings.defaultLang, i18nInstance]);

  const setLang = useCallback((l: Language) => {
    if (!SUPPORTED.includes(l)) return;
    i18nInstance.changeLanguage(l);
  }, [i18nInstance]);

  // <html lang> + <link rel="alternate" hreflang> para SEO
  useEffect(() => {
    const htmlLangMap: Record<Language, string> = {
      es: 'es',
      en: 'en',
      pt: 'pt-PT',
      'pt-BR': 'pt-BR',
    };
    document.documentElement.lang = htmlLangMap[lang];

    const head = document.head;
    head.querySelectorAll('link[data-i18n="hreflang"]').forEach((el) => el.remove());

    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const alternates: Array<{ hreflang: string; lang: Language }> = settings.enabled.map((l) => ({ hreflang: l, lang: l }));
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
  }, [lang, settings.enabled]);

  const t = useCallback(
    (key: string, options?: Record<string, unknown>): string =>
      i18nT(key, options as any) as string,
    [i18nT, lang],
  );

  const availableLanguages = useMemo(
    () => languages.filter((l) => settings.enabled.includes(l.code)),
    [settings.enabled],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, refreshSeoTags, enabledLanguages: settings.enabled, availableLanguages }}>
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
