// Captures a PayPal order after buyer approval in the popup. The frontend
// Smart Button calls this in its `onApprove` handler with the orderID
// returned from paypal-create-order.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveGatewayCredentials } from "../_shared/gateway-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function baseUrlFor(env: string) {
  return env === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) throw new Error(data?.error_description || `PayPal OAuth ${res.status}`);
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { paypal_order_id, order_id } = await req.json();
    if (!paypal_order_id) throw new Error('paypal_order_id obrigatório');

    const resolved = await resolveGatewayCredentials(supabase, 'paypal');
    const clientId = resolved.credentials.client_id;
    const clientSecret = resolved.credentials.client_secret;
    if (!clientId || !clientSecret) throw new Error('PayPal não configurado');

    const baseUrl = baseUrlFor(resolved.environment);
    const token = await getAccessToken(baseUrl, clientId, clientSecret);

    const r = await fetch(`${baseUrl}/v2/checkout/orders/${paypal_order_id}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.message || `PayPal capture ${r.status}: ${JSON.stringify(data?.details || data)}`);

    const captureStatus = data?.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    const finalStatus = captureStatus === 'COMPLETED' ? 'CONFIRMED' : (captureStatus === 'DECLINED' ? 'DECLINED' : 'PENDING');

    if (order_id) {
      await supabase.from('orders').update({
        status: finalStatus,
        payment_gateway: 'paypal',
        gateway_account_id: resolved.accountId,
      }).eq('id', order_id);
    }

    return new Response(JSON.stringify({ status: data.status, captureStatus, finalStatus, raw: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[paypal-capture-order]', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
