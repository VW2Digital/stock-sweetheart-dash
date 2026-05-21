import { useEffect, useState } from 'react';
import { fetchSettingsBulk } from '@/lib/api';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, normalizeLng } from '@/i18n';

export interface LanguageSettings {
  enabled: SupportedLanguage[];
  defaultLang: SupportedLanguage;
  loading: boolean;
}

const ALL: SupportedLanguage[] = [...SUPPORTED_LANGUAGES];

const parseEnabled = (raw: string): SupportedLanguage[] => {
  if (!raw) return ALL;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return ALL;
    const filtered = arr
      .map((v) => normalizeLng(String(v)))
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter((v) => (ALL as string[]).includes(v));
    return filtered.length > 0 ? (filtered as SupportedLanguage[]) : ALL;
  } catch {
    return ALL;
  }
};

let cache: { enabled: SupportedLanguage[]; defaultLang: SupportedLanguage } | null = null;
let inflight: Promise<{ enabled: SupportedLanguage[]; defaultLang: SupportedLanguage }> | null = null;

export const loadLanguageSettings = async () => {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetchSettingsBulk(['enabled_languages', 'default_language'])
    .then((map) => {
      const enabled = parseEnabled(map.enabled_languages || '');
      let defaultLang = normalizeLng(map.default_language || 'en');
      if (!enabled.includes(defaultLang)) defaultLang = enabled[0];
      cache = { enabled, defaultLang };
      return cache;
    })
    .catch(() => {
      cache = { enabled: ALL, defaultLang: 'en' };
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export const invalidateLanguageSettingsCache = () => {
  cache = null;
};

export const useLanguageSettings = (): LanguageSettings => {
  const [state, setState] = useState<LanguageSettings>(() => ({
    enabled: cache?.enabled || ALL,
    defaultLang: cache?.defaultLang || 'en',
    loading: !cache,
  }));

  useEffect(() => {
    let cancelled = false;
    loadLanguageSettings().then((s) => {
      if (!cancelled) setState({ ...s, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
