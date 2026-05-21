import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './locales/es.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const normalizeLng = (lng: string | undefined): SupportedLanguage => {
  if (!lng) return 'es';
  const lower = lng.toLowerCase();
  if (lower.startsWith('en')) return 'en';
  return 'es';
};

/**
 * Mapa BCP-47 usado em Intl.* (moeda, data, número).
 */
export const INTL_LOCALES: Record<SupportedLanguage, string> = {
  es: 'es-ES',
  en: 'en-US',
};

const DEFAULT_CURRENCY: Record<SupportedLanguage, string> = {
  es: 'EUR',
  en: 'USD',
};

const intlLocale = (lng: string | undefined): string =>
  INTL_LOCALES[normalizeLng(lng)] || INTL_LOCALES['es'];

/**
 * i18next: motor de tradução de toda a aplicação.
 *
 * - Padrão e fallback: PT (Português de Portugal). Forçado por requisito.
 * - Deteção: ?lang= na URL → localStorage → cookie. NÃO usa o idioma do browser,
 *   para garantir que PT-PT é sempre o ponto de partida.
 * - Persistência: cookie + localStorage, chave `language`.
 *
 * Formatadores disponíveis dentro das traduções via `{{var, formato}}`:
 *  - `{{price, currency}}`            → R$ 1.234,56 (BRL por padrão)
 *  - `{{price, currency(USD)}}`       → moeda explícita
 *  - `{{n, number}}`                  → número localizado
 *  - `{{n, number(2)}}`               → número com N casas decimais
 *  - `{{n, percent}}`                 → 0.12 → 12%
 *  - `{{date, date}}`                 → data curta
 *  - `{{date, date(long)}}`           → data longa
 *  - `{{date, datetime}}`             → data + hora curta
 *  - `{{date, relative}}`             → "há 3 dias"
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    ns: ['translation'],
    defaultNS: 'translation',
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'es',
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    interpolation: {
      escapeValue: false,
      // Aceita pluralização e variáveis. Datas/valores formatados via formatter abaixo.
    },
    detection: {
      // Não inclui 'navigator' — PT é forçado se nada estiver guardado.
      order: ['querystring', 'localStorage', 'cookie'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'language',
      lookupCookie: 'language',
      convertDetectedLanguage: (lng: string) => normalizeLng(lng),
      caches: ['localStorage', 'cookie'],
      cookieMinutes: 60 * 24 * 365, // 1 ano
      cookieOptions: { path: '/', sameSite: 'lax' },
    },
    returnNull: false,
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (lngs, _ns, key) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] chave em falta para ${lngs.join(',')}: "${key}"`);
      }
    },
  });

// Formatadores Intl reutilizando o locale BCP-47 do idioma atual.
i18n.services.formatter?.add('currency', (value, lng, options) => {
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  const currency = (options?.currency as string) || DEFAULT_CURRENCY[normalizeLng(lng)] || 'BRL';
  return new Intl.NumberFormat(intlLocale(lng), {
    style: 'currency',
    currency,
  }).format(num);
});

i18n.services.formatter?.add('number', (value, lng, options) => {
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  const digits = options?.minimumFractionDigits ?? options?.decimals;
  const opts: Intl.NumberFormatOptions = {};
  if (typeof digits === 'number') {
    opts.minimumFractionDigits = digits;
    opts.maximumFractionDigits = digits;
  }
  return new Intl.NumberFormat(intlLocale(lng), opts).format(num);
});

i18n.services.formatter?.add('percent', (value, lng) => {
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat(intlLocale(lng), { style: 'percent', maximumFractionDigits: 2 }).format(num);
});

const toDate = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

i18n.services.formatter?.add('date', (value, lng, options) => {
  const d = toDate(value);
  if (!d) return String(value ?? '');
  const style = (options?.style as 'short' | 'medium' | 'long' | 'full') || 'short';
  return new Intl.DateTimeFormat(intlLocale(lng), { dateStyle: style }).format(d);
});

i18n.services.formatter?.add('datetime', (value, lng, options) => {
  const d = toDate(value);
  if (!d) return String(value ?? '');
  return new Intl.DateTimeFormat(intlLocale(lng), {
    dateStyle: (options?.dateStyle as any) || 'short',
    timeStyle: (options?.timeStyle as any) || 'short',
  }).format(d);
});

i18n.services.formatter?.add('relative', (value, lng) => {
  const d = toDate(value);
  if (!d) return String(value ?? '');
  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(intlLocale(lng), { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
    ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === 'second') {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return String(value);
});

/**
 * Helpers fora de componentes React (e.g. em libs ou edge-side rendering).
 */
export const formatCurrency = (value: number, currency = 'BRL', lng?: string) =>
  new Intl.NumberFormat(intlLocale(lng || i18n.language), { style: 'currency', currency }).format(value);

export const formatDate = (
  value: Date | string | number,
  style: 'short' | 'medium' | 'long' | 'full' = 'short',
  lng?: string,
) => {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(intlLocale(lng || i18n.language), { dateStyle: style }).format(d);
};

export default i18n;
