import { supabase } from '@/integrations/supabase/client';

export type AbVariantConfig = {
  ctaText: string;
  discountBadgeTemplate: string; // {pct} placeholder
  showOfferBadge: boolean;
  showFreeShippingImageBadge: boolean;
  showFreeShippingBanner: boolean;
  showBestsellerBadge: boolean;
};

export type AbTestConfig = {
  A: AbVariantConfig;
  B: AbVariantConfig;
};

export const DEFAULT_AB_CONFIG: AbTestConfig = {
  A: {
    ctaText: 'Adicionar ao Carrinho',
    discountBadgeTemplate: '-{pct}%',
    showOfferBadge: true,
    showFreeShippingImageBadge: false,
    showFreeShippingBanner: true,
    showBestsellerBadge: true,
  },
  B: {
    ctaText: 'Adicionar ao Carrinho',
    discountBadgeTemplate: '-{pct}% OFF',
    showOfferBadge: true,
    showFreeShippingImageBadge: true,
    showFreeShippingBanner: false,
    showBestsellerBadge: true,
  },
};

export const AB_CONFIG_KEY = 'ab_test_variants';

let cache: AbTestConfig | null = null;
let cachePromise: Promise<AbTestConfig> | null = null;

export function getCachedAbConfig(): AbTestConfig {
  return cache ?? DEFAULT_AB_CONFIG;
}

export async function loadAbConfig(force = false): Promise<AbTestConfig> {
  if (cache && !force) return cache;
  if (cachePromise && !force) return cachePromise;
  cachePromise = (async () => {
    try {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', AB_CONFIG_KEY)
        .maybeSingle();
      if (data?.value) {
        const parsed = JSON.parse(data.value);
        cache = {
          A: { ...DEFAULT_AB_CONFIG.A, ...(parsed.A || {}) },
          B: { ...DEFAULT_AB_CONFIG.B, ...(parsed.B || {}) },
        };
        return cache;
      }
    } catch {
      // silencioso
    }
    cache = DEFAULT_AB_CONFIG;
    return cache;
  })();
  return cachePromise;
}

export async function saveAbConfig(cfg: AbTestConfig, userId: string): Promise<void> {
  const value = JSON.stringify(cfg);
  // upsert por key
  const { data: existing } = await supabase
    .from('site_settings')
    .select('id')
    .eq('key', AB_CONFIG_KEY)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await supabase
      .from('site_settings')
      .update({ value })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('site_settings')
      .insert({ key: AB_CONFIG_KEY, value, user_id: userId });
    if (error) throw error;
  }
  cache = cfg;
}

export function formatDiscountBadge(template: string, pct: number): string {
  return (template || '-{pct}%').replace('{pct}', String(pct));
}