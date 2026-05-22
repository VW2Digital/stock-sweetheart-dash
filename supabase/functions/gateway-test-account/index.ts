import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type GatewayKey = 'asaas' | 'mercadopago' | 'pagbank' | 'pagarme' | 'appmax' | 'paypal';

interface TestResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

async function probe(
  url: string,
  init: RequestInit,
): Promise<{ status: number; ok: boolean; body: unknown; raw: string; url: string; method: string }> {
  const res = await fetch(url, init);
  const raw = await res.text();
  let body: unknown = raw;
  try { body = JSON.parse(raw); } catch { /* keep text */ }
  return { status: res.status, ok: res.ok, body, raw, url, method: (init.method as string) || 'GET' };
}

async function testAsaas(creds: Record<string, string>, environment: string): Promise<TestResult> {
  const apiKey = creds.api_key;
  if (!apiKey) return { ok: false, message: 'api_key ausente', details: { hint: 'Cadastre o campo api_key na conta.' } };
  const baseUrl = environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
  const r = await probe(`${baseUrl}/finance/getCurrentBalance`, {
    headers: { access_token: apiKey, 'Content-Type': 'application/json' },
  });
  const b: any = r.body;
  if (r.ok) {
    return { ok: true, message: `Conectado (${environment}). Saldo: R$ ${b?.totalBalance ?? 0}`, details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status } };
  }
  return {
    ok: false,
    message: `Asaas ${r.status}: ${b?.errors?.[0]?.description || b?.message || 'falha de autenticação'}`,
    details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status, raw: r.raw.slice(0, 2000) },
  };
}

async function testMercadoPago(creds: Record<string, string>): Promise<TestResult> {
  const token = creds.access_token;
  if (!token) return { ok: false, message: 'access_token ausente', details: { hint: 'Cadastre o campo access_token na conta.' } };
  const r = await probe('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const b: any = r.body;
  if (r.ok) {
    return { ok: true, message: `Conectado como ${b?.nickname || b?.email || b?.id}`, details: { request: { url: r.url, method: r.method }, response: { id: b?.id, site_id: b?.site_id, nickname: b?.nickname }, status: r.status } };
  }
  return {
    ok: false,
    message: `Mercado Pago ${r.status}: ${b?.message || 'token inválido'}`,
    details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status, raw: r.raw.slice(0, 2000) },
  };
}

async function testPagBank(creds: Record<string, string>, environment: string): Promise<TestResult> {
  const token = creds.token;
  if (!token) return { ok: false, message: 'token ausente', details: { hint: 'Cadastre o campo token na conta.' } };
  const baseUrl = environment === 'production' ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';
  const r = await probe(`${baseUrl}/public-keys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ type: 'card' }),
  });
  const b: any = r.body;
  if (r.ok) {
    return { ok: true, message: `Conectado (${environment}). Public key obtida.`, details: { request: { url: r.url, method: r.method }, response: { hasKey: Boolean(b?.public_key) }, status: r.status } };
  }
  if (r.status === 401 || r.status === 403) {
    return { ok: false, message: `PagBank ${r.status}: token rejeitado`, details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status, raw: r.raw.slice(0, 2000) } };
  }
  return {
    ok: false,
    message: `PagBank ${r.status}: ${b?.error_messages?.[0]?.description || JSON.stringify(b).slice(0, 120)}`,
    details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status, raw: r.raw.slice(0, 2000) },
  };
}

async function testPagarMe(creds: Record<string, string>): Promise<TestResult> {
  const secret = creds.secret_key;
  if (!secret) return { ok: false, message: 'secret_key ausente', details: { hint: 'Cadastre o campo secret_key na conta.' } };
  const auth = btoa(`${secret}:`);
  const r = await probe('https://api.pagar.me/core/v5/balance', {
    headers: { Authorization: `Basic ${auth}` },
  });
  const b: any = r.body;
  if (r.ok) {
    return { ok: true, message: `Conectado. Disponível: ${b?.available?.amount ?? 0}`, details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status } };
  }
  if (r.status === 404) {
    return { ok: true, message: 'Chave aceita (sem recurso de saldo)', details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status } };
  }
  return {
    ok: false,
    message: `Pagar.me ${r.status}: ${b?.message || 'chave inválida'}`,
    details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status, raw: r.raw.slice(0, 2000) },
  };
}

async function testAppmax(creds: Record<string, string>, environment: string): Promise<TestResult> {
  const token = creds.access_token;
  if (!token) return { ok: false, message: 'access_token ausente', details: { hint: 'Cadastre o campo access_token na conta.' } };
  const baseUrl = environment === 'sandbox'
    ? 'https://homolog.sandboxappmax.com.br/api/v3'
    : 'https://admin.appmax.com.br/api/v3';
  const r = await probe(`${baseUrl}/customer/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ 'access-token': token, page: 1, per_page: 1 }),
  });
  if (r.status === 401 || r.status === 403) {
    return { ok: false, message: `Appmax ${r.status}: token rejeitado`, details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status } };
  }
  if (r.ok || r.status === 404 || r.status === 422) {
    return { ok: true, message: `Conectado (${environment}). Token aceito.`, details: { request: { url: r.url, method: r.method }, status: r.status } };
  }
  const b: any = r.body;
  return {
    ok: false,
    message: `Appmax ${r.status}: ${b?.text || b?.message || 'erro desconhecido'}`,
    details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status, raw: r.raw.slice(0, 2000) },
  };
}

async function testPayPal(creds: Record<string, string>, environment: string): Promise<TestResult> {
  const clientId = creds.client_id;
  const clientSecret = creds.client_secret;
  if (!clientId || !clientSecret) {
    return { ok: false, message: 'client_id e client_secret são obrigatórios', details: { hint: 'Cadastre Client ID e Secret do app PayPal.' } };
  }
  const baseUrl = environment === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
  const auth = btoa(`${clientId}:${clientSecret}`);
  const r = await probe(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  const b: any = r.body;
  if (r.ok && b?.access_token) {
    return {
      ok: true,
      message: `Conectado (${environment}). Token OAuth obtido.`,
      details: { request: { url: r.url, method: r.method }, response: { app_id: b?.app_id, scope: b?.scope?.slice(0, 100), expires_in: b?.expires_in }, status: r.status },
    };
  }
  return {
    ok: false,
    message: `PayPal ${r.status}: ${b?.error_description || b?.error || 'credenciais inválidas'}`,
    details: { request: { url: r.url, method: r.method }, response: r.body, status: r.status, raw: r.raw.slice(0, 2000) },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(url, key);

    const { account_id, environment_override } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ ok: false, message: 'account_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: account, error } = await supabase
      .from('gateway_accounts')
      .select('id, gateway, environment, credentials, label')
      .eq('id', account_id)
      .maybeSingle();

    if (error || !account) {
      return new Response(JSON.stringify({ ok: false, message: 'Conta não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gateway = account.gateway as GatewayKey;
    const creds = (account.credentials || {}) as Record<string, string>;
    const env = (environment_override === 'production' || environment_override === 'sandbox')
      ? environment_override
      : (account.environment || 'sandbox');

    const startedAt = Date.now();
    let result: TestResult;
    try {
      switch (gateway) {
        case 'asaas': result = await testAsaas(creds, env); break;
        case 'mercadopago': result = await testMercadoPago(creds); break;
        case 'pagbank': result = await testPagBank(creds, env); break;
        case 'pagarme': result = await testPagarMe(creds); break;
        case 'appmax': result = await testAppmax(creds, env); break;
        case 'paypal': result = await testPayPal(creds, env); break;
        default: result = { ok: false, message: `Gateway ${gateway} não suportado` };
      }
    } catch (e) {
      result = { ok: false, message: `Falha de rede: ${(e as Error).message}`, details: { error: String(e), stack: (e as Error).stack } };
    }
    const durationMs = Date.now() - startedAt;

    return new Response(JSON.stringify({ ...result, gateway, environment: env, label: account.label, durationMs, testedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: (e as Error).message, details: { stack: (e as Error).stack } }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
