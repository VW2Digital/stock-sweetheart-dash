import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const memCache = new Map<string, string>();

const CACHE_VERSION = 'v2';

function loadCache(target: string, text: string): string | null {
  const key = `aitr:${CACHE_VERSION}:${target}:${text}`;
  if (memCache.has(key)) return memCache.get(key)!;
  try {
    const v = sessionStorage.getItem(key);
    if (v) { memCache.set(key, v); return v; }
  } catch {}
  return null;
}

function saveCache(target: string, text: string, value: string) {
  const key = `aitr:${CACHE_VERSION}:${target}:${text}`;
  memCache.set(key, value);
  try { sessionStorage.setItem(key, value); } catch {}
}

/**
 * Translates an array of strings to the target language via the
 * `translate-text` edge function. When target is 'pt-PT' (source) or empty,
 * the original strings are returned unchanged.
 */
export function useAITranslateBatch(texts: string[], target: string) {
  const [result, setResult] = useState<string[]>(texts);

  useEffect(() => {
    if (!target || target === 'pt-PT' || target === 'pt' || texts.length === 0) {
      setResult(texts);
      return;
    }
    const cached: (string | null)[] = texts.map((t) => loadCache(target, t));
    const initial = texts.map((t, i) => cached[i] ?? t);
    setResult(initial);

    const missingIdx: number[] = [];
    const missingTexts: string[] = [];
    texts.forEach((t, i) => {
      if (cached[i] == null && t && t.trim().length > 0) {
        missingIdx.push(i);
        missingTexts.push(t);
      }
    });
    if (missingTexts.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('translate-text', {
          body: { texts: missingTexts, target },
        });
        if (cancelled || error) return;
        const translations: string[] = Array.isArray((data as any)?.translations) ? (data as any).translations : missingTexts;
        const next = [...initial];
        missingIdx.forEach((origIdx, k) => {
          const value = translations[k] ?? missingTexts[k];
          saveCache(target, missingTexts[k], value);
          next[origIdx] = value;
        });
        setResult(next);
      } catch {
        // keep original
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts.join('\u0001'), target]);

  return result;
}