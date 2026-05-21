import { useEffect, useState } from 'react';
import { fetchSetting } from '@/lib/api';

let cache: boolean | null = null;
let inflight: Promise<boolean> | null = null;

export const loadShippingEnabled = async (): Promise<boolean> => {
  if (cache !== null) return cache;
  if (inflight) return inflight;
  inflight = fetchSetting('shipping_enabled')
    .then((v) => {
      // Default to enabled when never configured.
      const enabled = v === '' || v === null || v === undefined ? true : v !== 'false';
      cache = enabled;
      return enabled;
    })
    .catch(() => {
      cache = true;
      return true;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export const invalidateShippingEnabledCache = () => {
  cache = null;
};

export const useShippingEnabled = () => {
  const [enabled, setEnabled] = useState<boolean>(cache ?? true);
  const [loading, setLoading] = useState<boolean>(cache === null);

  useEffect(() => {
    let cancelled = false;
    loadShippingEnabled().then((v) => {
      if (!cancelled) {
        setEnabled(v);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading };
};
