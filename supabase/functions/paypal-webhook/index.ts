// PayPal webhook handler. Updates the local order based on payment events.
// Signature verification (optional) uses the configured paypal_webhook_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveGatewayCredentials } from "../_shared/gateway-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time, paypal-cert-url, paypal-auth-algo',
};

function baseUrlFor(env: string) {
  return env === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

function mapEventToStatus(eventType: string): string | null {
  const map: Record<string, string> = {
    'PAYMENT.CAPTURE.COMPLETED': 'CONFIRMED',
    'CHECKOUT.ORDER.APPROVED': 'PENDING',
    'PAYMENT.CAPTURE.DENIED': 'DECLINED',
    'PAYMENT.CAPTURE.REFUNDED': 'REFUNDED',
    'PAYMENT.CAPTURE.REVERSED': 'REFUNDED',
    'CHECKOUT.ORDER.VOIDED': 'CANCELLED',
  };
  return map[eventType] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  // Always return 200 to avoid PayPal disabling the webhook on errors.
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const raw = await req.text();
    let event: any;
    try { event = JSON.parse(raw); } catch { event = {}; }

    const eventType = event?.event_type as string | undefined;
    console.log('[paypal-webhook] event:', eventType);

    // Optional signature verification
    const resolved = await resolveGatewayCredentials(supabase, 'paypal');
    const clientId = resolved.credentials.client_id;
    const clientSecret = resolved.credentials.client_secret;
    const webhookId = resolved.credentials.webhook_id;

    if (webhookId && clientId && clientSecret) {
      try {
        const baseUrl = baseUrlFor(resolved.environment);
        const token = await getAccessToken(baseUrl, clientId, clientSecret);
        const verifyBody = {
          auth_algo: req.headers.get('paypal-auth-algo'),
          cert_url: req.headers.get('paypal-cert-url'),
          transmission_id: req.headers.get('paypal-transmission-id'),
          transmission_sig: req.headers.get('paypal-transmission-sig'),
          transmission_time: req.headers.get('paypal-transmission-time'),
          webhook_id: webhookId,
          webhook_event: event,
        };
        const vr = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(verifyBody),
        });
        const vd = await vr.json();
        if (vd?.verification_status !== 'SUCCESS') {
          console.warn('[paypal-webhook] signature verification failed:', vd);
          return new Response(JSON.stringify({ received: true, verified: false }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        console.warn('[paypal-webhook] verification error:', (e as Error).message);
      }
    }

    if (!eventType) {
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const newStatus = mapEventToStatus(eventType);
    if (!newStatus) {
      return new Response(JSON.stringify({ received: true, ignored: eventType }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Look up the order via PayPal order ID stored in asaas_payment_id (reused field)
    const resource = event?.resource || {};
    const paypalOrderId = resource?.supplementary_data?.related_ids?.order_id
      || resource?.id
      || resource?.purchase_units?.[0]?.payments?.captures?.[0]?.supplementary_data?.related_ids?.order_id;
    const customId = resource?.custom_id || resource?.purchase_units?.[0]?.custom_id;

    let query = supabase.from('orders').select('id, status').limit(1);
    if (customId) query = query.eq('id', customId);
    else if (paypalOrderId) query = query.eq('asaas_payment_id', paypalOrderId);
    else {
      return new Response(JSON.stringify({ received: true, error: 'no order reference' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: orders } = await query;
    const order = orders?.[0];
    if (!order) {
      return new Response(JSON.stringify({ received: true, error: 'order not found' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Status priority — don't downgrade a CONFIRMED order
    const priority: Record<string, number> = { PENDING: 1, DECLINED: 2, CANCELLED: 3, REFUNDED: 4, CONFIRMED: 5 };
    if ((priority[order.status] || 0) > (priority[newStatus] || 0)) {
      return new Response(JSON.stringify({ received: true, kept: order.status }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await supabase.from('orders').update({ status: newStatus, payment_gateway: 'paypal' }).eq('id', order.id);
    return new Response(JSON.stringify({ received: true, order: order.id, status: newStatus }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[paypal-webhook] error:', err);
    return new Response(JSON.stringify({ received: true, error: err.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
