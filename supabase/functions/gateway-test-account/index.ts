import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type GatewayKey = 'asaas' | 'mercadopago' | 'pagbank' | 'pagarme';

interface TestResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

async function testAsaas(creds: Record<string, string>, environment: string): Promise<TestResult> {
  const apiKey = creds.api_key;
  if (!apiKey) return { ok: false, message: 'api_key ausente' };
  const baseUrl = environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
  const res = await fetch(`${baseUrl}/finance/getCurrentBalance`, {
    headers: { access_token: apiKey, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    return { ok: true, message: `Conectado (${environment}). Saldo: R$ ${body.totalBalance ?? 0}`, details: body };
  }
  return { ok: false, message: `Asaas ${res.status}: ${body?.errors?.[0]?.description || body?.message || 'falha de autenticação'}` };
}

async function testMercadoPago(creds: Record<string, string>): Promise<TestResult> {
  const token = creds.access_token;
  if (!token) return { ok: false, message: 'access_token ausente' };
  const res = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    return { ok: true, message: `Conectado como ${body.nickname || body.email || body.id}`, details: { id: body.id, site_id: body.site_id } };
  }
  return { ok: false, message: `Mercado Pago ${res.status}: ${body?.message || 'token inválido'}` };
}

async function testPagBank(creds: Record<string, string>, environment: string): Promise<TestResult> {
  const token = creds.token;
  if (!token) return { ok: false, message: 'token ausente' };
  const baseUrl = environment === 'production' ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';
  // POST /public-keys com type=card é leve e exige token válido
  const res = await fetch(`${baseUrl}/public-keys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ type: 'card' }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok || res.status === 200) {
    return { ok: true, message: `Conectado (${environment}). Public key obtida.`, details: { hasKey: Boolean(body.public_key) } };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: `PagBank ${res.status}: token rejeitado` };
  }
  return { ok: false, message: `PagBank ${res.status}: ${body?.error_messages?.[0]?.description || JSON.stringify(body).slice(0, 120)}` };
}

async function testPagarMe(creds: Record<string, string>): Promise<TestResult> {
  const secret = creds.secret_key;
  if (!secret) return { ok: false, message: 'secret_key ausente' };
  const auth = btoa(`${secret}:`);
  const res = await fetch('https://api.pagar.me/core/v5/balance', {
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    return { ok: true, message: `Conectado. Disponível: ${body.available?.amount ?? 0}`, details: body };
  }
  if (res.status === 404) {
    // 404 ainda significa autenticado (recurso inexistente para a conta) — chave válida
    return { ok: true, message: 'Chave aceita (sem recurso de saldo)' };
  }
  return { ok: false, message: `Pagar.me ${res.status}: ${body?.message || 'chave inválida'}` };
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

    let result: TestResult;
    try {
      switch (gateway) {
        case 'asaas': result = await testAsaas(creds, env); break;
        case 'mercadopago': result = await testMercadoPago(creds); break;
        case 'pagbank': result = await testPagBank(creds, env); break;
        case 'pagarme': result = await testPagarMe(creds); break;
        default: result = { ok: false, message: `Gateway ${gateway} não suportado` };
      }
    } catch (e) {
      result = { ok: false, message: `Falha de rede: ${(e as Error).message}` };
    }

    return new Response(JSON.stringify({ ...result, gateway, environment: env, label: account.label }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
