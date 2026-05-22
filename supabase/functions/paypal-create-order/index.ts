// Creates a PayPal order on the backend (server-side) and returns its ID
// to the frontend Smart Button (which then redirects the user to PayPal
// approval popup). Once approved, the frontend calls paypal-capture-order.
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
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || `PayPal OAuth ${res.status}`);
  }
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { order_id, amount, currency = 'BRL', description } = await req.json();
    if (!amount) throw new Error('amount obrigatório');

    const resolved = await resolveGatewayCredentials(supabase, 'paypal');
    const clientId = resolved.credentials.client_id;
    const clientSecret = resolved.credentials.client_secret;
    if (!clientId || !clientSecret) throw new Error('PayPal não configurado');

    const baseUrl = baseUrlFor(resolved.environment);
    const token = await getAccessToken(baseUrl, clientId, clientSecret);

    const value = Number(amount).toFixed(2);
    const body = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order_id || undefined,
        description: (description || 'Pedido').slice(0, 127),
        amount: { currency_code: currency.toUpperCase(), value },
        custom_id: order_id || undefined,
      }],
    };

    const r = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.message || `PayPal create order ${r.status}: ${JSON.stringify(data?.details || data)}`);

    // Persist PayPal order ID on the local order for later reconciliation
    if (order_id && data?.id) {
      await supabase.from('orders').update({
        asaas_payment_id: data.id,
        payment_gateway: 'paypal',
        gateway_account_id: resolved.accountId,
        status: 'PENDING',
      }).eq('id', order_id);
    }

    return new Response(JSON.stringify({ id: data.id, status: data.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[paypal-create-order]', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
