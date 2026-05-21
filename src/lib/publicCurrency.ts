/**
 * Moeda do site público — vinculada ao idioma do cliente.
 *
 * Mapeamento fixo:
 *   pt → BRL (R$)
 *   en → USD (US$)
 *   es → EUR (€)
 *
 * Taxas de câmbio são buscadas da API gratuita https://api.exchangerate.host
 * (sem chave) e cacheadas em localStorage por 24h.
 *
 * IMPORTANTE: a cobrança real é sempre em BRL (gateways brasileiros: Asaas,
 * Mercado Pago, PagBank, Pagar.me). A conversão é puramente visual no catálogo,
 * página de produto e carrinho. No checkout final mostramos um aviso.
 */
import { useEffect, useState } from 'react';
import { useLanguage, type Language } from '@/contexts/LanguageContext';

export type PublicCurrency = 'BRL' | 'USD' | 'EUR';

interface CurrencyMeta {
  code: PublicCurrency;
  locale: string;
  symbol: string;
}

const LANG_TO_CURRENCY: Record<Language, CurrencyMeta> = {
  en: { code: 'USD', locale: 'en-US', symbol: 'US$' },
  es: { code: 'EUR', locale: 'es-ES', symbol: '€' },
};

const DEFAULT_RATES: Record<PublicCurrency, number> = {
  BRL: 1,
  USD: 0.18,
  EUR: 0.17,
};

const STORAGE_KEY = 'public_currency_rates_v1';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CachedRates {
  fetchedAt: number;
  rates: Record<PublicCurrency, number>;
}

function readCache(): CachedRates | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (!parsed?.rates || !parsed?.fetchedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(rates: Record<PublicCurrency, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fetchedAt: Date.now(), rates }));
  } catch { /* noop */ }
}

let inflight: Promise<Record<PublicCurrency, number>> | null = null;

async function fetchRates(): Promise<Record<PublicCurrency, number>> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // base BRL, queremos USD e EUR
      const res = await fetch('https://api.exchangerate.host/latest?base=BRL&symbols=USD,EUR', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('rate fetch failed');
      const json = await res.json();
      const usd = Number(json?.rates?.USD);
      const eur = Number(json?.rates?.EUR);
      if (!Number.isFinite(usd) || !Number.isFinite(eur) || usd <= 0 || eur <= 0) {
        throw new Error('invalid rate payload');
      }
      const rates: Record<PublicCurrency, number> = { BRL: 1, USD: usd, EUR: eur };
      writeCache(rates);
      return rates;
    } catch {
      return DEFAULT_RATES;
    } finally {
      // libera para próximas tentativas futuras (após cache expirar)
      setTimeout(() => { inflight = null; }, 1000);
    }
  })();
  return inflight;
}

export function getCurrencyForLanguage(lang: Language): CurrencyMeta {
  return LANG_TO_CURRENCY[lang] || LANG_TO_CURRENCY['es'];
}

/**
 * Hook principal — devolve formatador que recebe valor em BRL e devolve string
 * formatada na moeda do idioma atual.
 */
export function usePublicCurrency() {
  const { lang } = useLanguage();
  const meta = getCurrencyForLanguage(lang);
  const [rates, setRates] = useState<Record<PublicCurrency, number>>(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.rates;
    return cached?.rates || DEFAULT_RATES;
  });

  useEffect(() => {
    const cached = readCache();
    const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS;
    if (fresh) {
      setRates(cached.rates);
      return;
    }
    fetchRates().then((r) => setRates(r));
  }, []);

  const rate = rates[meta.code] ?? 1;

  const convert = (brl: number): number => (Number.isFinite(brl) ? brl : 0) * rate;

  const format = (
    brl: number,
    opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
  ): string => {
    const converted = convert(brl);
    try {
      return converted.toLocaleString(meta.locale, {
        style: 'currency',
        currency: meta.code,
        minimumFractionDigits: opts?.minimumFractionDigits ?? 2,
        maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
      });
    } catch {
      return `${meta.symbol} ${converted.toFixed(2)}`;
    }
  };

  return {
    currency: meta.code,
    locale: meta.locale,
    symbol: meta.symbol,
    isBRL: meta.code === 'BRL',
    rate,
    convert,
    format,
  };
}
