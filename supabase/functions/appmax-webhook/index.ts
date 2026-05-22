import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-appmax-signature',
};

// Maps Appmax event types / status to our normalized order status.
function mapEventToStatus(eventType: string, statusRaw?: string): string | null {
  const e = (eventType || '').toLowerCase();
  if (e.includes('paid') || e === 'orderpaid' || e === 'orderpaidbypix' || e === 'orderapproved' || e === 'orderauthorized') return 'PAID';
  if (e.includes('refund') || e.includes('estorn')) return 'REFUNDED';
  if (e.includes('chargeback')) return 'CHARGEBACK';
  if (e.includes('expir') || e.includes('canceled') || e.includes('cancelled') || e.includes('cancel')) return 'CANCELLED';
  if (e.includes('notauthorized') || e.includes('refused') || e.includes('declined') || e.includes('reprov')) return 'REFUSED';
  if (e.includes('pending') || e.includes('billet') || e.includes('integrated')) return 'PENDING';

  // Fallback: try generic status field
  const s = (statusRaw || '').toLowerCase();
  if (['aprovado', 'approved', 'paid', 'pago'].includes(s)) return 'PAID';
  if (['cancelado', 'cancelled', 'canceled'].includes(s)) return 'CANCELLED';
  if (['estornado', 'refunded'].includes(s)) return 'REFUNDED';
  if (['reprovado', 'rejected', 'declined'].includes(s)) return 'REFUSED';
  if (['pendente', 'pending'].includes(s)) return 'PENDING';
  return null;
}

const STATUS_PRIORITY: Record<string, number> = {
  PENDING: 1, IN_REVIEW: 2, OVERDUE: 3,
  REFUSED: 5, REPROVED: 5, CANCELLED: 6,
  PAID: 10, CONFIRMED: 10, RECEIVED: 10,
  REFUNDED: 11, CHARGEBACK: 12,
};

async function verifyHmac(req: Request, body: string, secret: string): Promise<boolean> {
  const header = req.headers.get('x-appmax-signature') || '';
  if (!header || !secret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const provided = header.replace(/^sha256=/, '');
  return hex === provided;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const logCtx: any = {
    gateway: 'appmax', event_type: null, http_status: 200,
    signature_valid: null, signature_error: null, order_id: null,
    external_id: null, error_message: null, request_payload: null,
  };
  let logged = false;
  const writeLog = async () => {
    if (logged) return;
    logged = true;
    try {
      await supabase.from('webhook_logs').insert({ ...logCtx, latency_ms: Date.now() - startedAt });
    } catch {}
  };

  try {
    const bodyText = await req.text();
    let payload: any = {};
    try { payload = JSON.parse(bodyText); } catch { payload = { raw: bodyText.slice(0, 500) }; }
    logCtx.request_payload = payload;

    // Optional HMAC validation if admin configured a webhook_secret
    const { data: secretRow } = await supabase
      .from('site_settings').select('value').eq('key', 'appmax_webhook_secret').maybeSingle();
    const secret = (secretRow as any)?.value || '';
    if (secret && req.headers.get('x-appmax-signature')) {
      const ok = await verifyHmac(req, bodyText, secret);
      logCtx.signature_valid = ok;
      if (!ok) {
        logCtx.signature_error = 'HMAC-SHA256 mismatch';
        console.warn('[Appmax Webhook] Invalid signature');
        await writeLog();
        return new Response(JSON.stringify({ received: true, error: 'invalid_signature' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      logCtx.signature_valid = secret ? null : true; // accepted without signature
    }

    const eventType: string = payload?.event || payload?.type || '';
    logCtx.event_type = eventType;
    const data = payload?.data || payload?.order || payload || {};
    const externalId = data?.id || data?.order_id || data?.transaction_id;
    if (externalId) logCtx.external_id = String(externalId);

    // Our internal order id can come back in different fields depending on
    // how the order was registered with Appmax.
    const orderCode: string | null =
      data?.cart_order_id ||
      data?.['cart-order-id'] ||
      data?.external_reference ||
      data?.reference_id ||
      (externalId ? String(externalId) : null);

    console.log(`[Appmax Webhook] event=${eventType} order=${orderCode}`);

    if (!orderCode) {
      console.warn('[Appmax Webhook] No order reference in payload');
      await writeLog();
      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    logCtx.order_id = orderCode;

    const newStatus = mapEventToStatus(eventType, data?.status);
    if (!newStatus) {
      console.log(`[Appmax Webhook] Event ${eventType} not actionable, acking.`);
      await writeLog();
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existing } = await supabase
      .from('orders')
      .select('id, status, coupon_code')
      .eq('id', orderCode)
      .maybeSingle();
    if (!existing) {
      console.warn(`[Appmax Webhook] Order not found: ${orderCode}`);
      await writeLog();
      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const previous = existing.status as string;
    const currentPriority = STATUS_PRIORITY[previous] ?? 0;
    const newPriority = STATUS_PRIORITY[newStatus] ?? 1;
    if (newPriority < currentPriority && previous !== newStatus) {
      console.log(`[Appmax Webhook] Skipped regression: ${previous} -> ${newStatus}`);
      await writeLog();
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updErr } = await supabase
      .from('orders')
      .update({ status: newStatus, asaas_payment_id: externalId || existing.id })
      .eq('id', orderCode);
    if (updErr) {
      console.error('[Appmax Webhook] DB update error:', updErr.message);
      logCtx.error_message = updErr.message;
    } else {
      console.log(`[Appmax Webhook] Order ${orderCode}: ${previous} -> ${newStatus}`);
      if (newStatus === 'PAID' && previous !== 'PAID' && existing.coupon_code) {
        try {
          await supabase.rpc('increment_coupon_usage', { _coupon_code: existing.coupon_code });
        } catch (e: any) {
          console.warn('[Appmax Webhook] Coupon increment error:', e.message);
        }
      }
    }

    await writeLog();
    return new Response(JSON.stringify({ received: true, status: newStatus }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[Appmax Webhook] Error:', e.message);
    logCtx.error_message = e.message;
    await writeLog();
    // Always return 200 so Appmax doesn't disable the webhook
    return new Response(JSON.stringify({ received: true, error: e.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
