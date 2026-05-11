const KEY = "reseller_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

type Stored = { code: string; ts: number };

export function captureResellerFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref && ref.trim()) {
      const payload: Stored = { code: ref.trim(), ts: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(payload));
    }
  } catch {
    /* noop */
  }
}

export function getResellerCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.code) return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function clearResellerCode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}