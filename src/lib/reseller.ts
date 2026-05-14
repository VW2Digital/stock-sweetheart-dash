import { supabase } from "@/integrations/supabase/client";

const KEY = "reseller_ref";
const SESSION_KEY = "reseller_session_id";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

type Stored = { code: string; ts: number };

export type ResellerEventType =
  | "visit"
  | "checkout_started"
  | "order_created"
  | "payment_failed"
  | "payment_paid";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid =
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? (crypto as Crypto).randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36));
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

export function captureResellerFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref && ref.trim()) {
      const code = ref.trim();
      const existing = localStorage.getItem(KEY);
      const isNew = (() => {
        try {
          const p = existing ? (JSON.parse(existing) as Stored) : null;
          return !p || p.code !== code;
        } catch {
          return true;
        }
      })();
      const payload: Stored = { code, ts: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(payload));
      // Registra a visita sempre que o link é aberto com ?ref=
      void trackResellerEvent("visit", { url: window.location.href, isNew });
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

/**
 * Registra um evento de funil do revendedor.
 * Silencioso por design: nunca quebra o fluxo do checkout.
 */
export async function trackResellerEvent(
  eventType: ResellerEventType,
  extras?: {
    orderId?: string | null;
    productName?: string | null;
    amount?: number | null;
    metadata?: Record<string, any>;
    url?: string | null;
    isNew?: boolean;
  }
) {
  try {
    const code = getResellerCode();
    if (!code) return;
    const sessionId = getOrCreateSessionId();
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess?.session?.user?.id || null;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const url = extras?.url ?? (typeof window !== "undefined" ? window.location.href : null);

    await supabase.from("reseller_events" as any).insert({
      reseller_code: code,
      event_type: eventType,
      session_id: sessionId || null,
      user_id: userId,
      order_id: extras?.orderId ?? null,
      product_name: extras?.productName ?? null,
      amount: extras?.amount ?? null,
      url,
      user_agent: ua,
      metadata: extras?.metadata ?? {},
    });
  } catch {
    /* tracking é best-effort; nunca interrompe o fluxo */
  }
}