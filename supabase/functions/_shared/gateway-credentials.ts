// Shared helper to resolve gateway credentials via the round-robin RPC
// `pick_next_gateway_account`. Falls back to legacy `site_settings` keys when
// no account exists for the requested gateway (back-compat).

export type GatewayKey = 'asaas' | 'mercadopago' | 'pagbank' | 'pagarme';

export interface ResolvedGatewayCredentials {
  accountId: string | null;
  environment: string;
  credentials: Record<string, string>;
}

/**
 * Required credential field for each gateway. Used to detect "empty"
 * accounts (created via UI but never filled in) so we can fall back to the
 * primary/legacy account instead of failing the checkout.
 */
const REQUIRED_FIELD: Record<GatewayKey, string> = {
  asaas: 'api_key',
  mercadopago: 'access_token',
  pagbank: 'token',
  pagarme: 'secret_key',
};

function hasRequiredCreds(gateway: GatewayKey, creds: Record<string, string>): boolean {
  const field = REQUIRED_FIELD[gateway];
  return Boolean(creds && creds[field] && String(creds[field]).trim().length > 0);
}

/** Returns the primary active account for the gateway, if any. */
export async function getPrimaryAccount(
  supabase: any,
  gateway: GatewayKey,
): Promise<ResolvedGatewayCredentials | null> {
  const { data } = await supabase
    .from('gateway_accounts')
    .select('id, environment, credentials, label')
    .eq('gateway', gateway)
    .eq('active', true)
    .eq('is_primary', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    accountId: data.id as string,
    environment: (data.environment as string) || 'sandbox',
    credentials: (data.credentials || {}) as Record<string, string>,
  };
}

async function readSetting(supabase: any, key: string): Promise<string> {
  const { data } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
  return (data as { value?: string } | null)?.value || '';
}

async function legacyCredentials(supabase: any, gateway: GatewayKey): Promise<ResolvedGatewayCredentials> {
  if (gateway === 'asaas') {
    const api_key = await readSetting(supabase, 'asaas_api_key');
    const environment = (await readSetting(supabase, 'asaas_environment')) || 'sandbox';
    const webhook_token = await readSetting(supabase, 'asaas_webhook_token');
    return { accountId: null, environment, credentials: { api_key, webhook_token } };
  }
  if (gateway === 'mercadopago') {
    const environment = (await readSetting(supabase, 'mercadopago_environment')) || 'sandbox';
    const access_token =
      (await readSetting(supabase, `mercadopago_access_token_${environment}`)) ||
      (await readSetting(supabase, 'mercadopago_access_token'));
    const public_key =
      (await readSetting(supabase, `mercadopago_public_key_${environment}`)) ||
      (await readSetting(supabase, 'mercadopago_public_key'));
    return { accountId: null, environment, credentials: { access_token, public_key } };
  }
  if (gateway === 'pagbank') {
    const token = await readSetting(supabase, 'pagbank_token');
    const environment = (await readSetting(supabase, 'pagbank_environment')) || 'sandbox';
    const email = await readSetting(supabase, 'pagbank_email');
    return { accountId: null, environment, credentials: { token, email } };
  }
  // pagarme
  const environment = (await readSetting(supabase, 'pagarme_environment')) || 'sandbox';
  const secret_key =
    (await readSetting(supabase, `pagarme_secret_key_${environment}`)) ||
    (await readSetting(supabase, 'pagarme_secret_key'));
  const public_key = await readSetting(supabase, 'pagarme_public_key');
  const webhook_secret = await readSetting(supabase, 'pagarme_webhook_secret');
  return { accountId: null, environment, credentials: { secret_key, public_key, webhook_secret } };
}

/**
 * Resolves credentials for the given gateway using round-robin selection from
 * the `gateway_accounts` table. Updates `last_used_at` server-side via RPC.
 * Falls back to legacy `site_settings` keys when no account is registered.
 */
export async function resolveGatewayCredentials(
  supabase: any,
  gateway: GatewayKey,
): Promise<ResolvedGatewayCredentials> {
  try {
    const { data, error } = await supabase.rpc('pick_next_gateway_account', { _gateway: gateway });
    if (error) {
      console.warn(`[gateway-credentials] RPC error for ${gateway}: ${error.message}. Trying primary account.`);
      return await fallbackChain(supabase, gateway, 'rpc-error');
    }
    if (data && data.id) {
      const creds = (data.credentials || {}) as Record<string, string>;
      if (hasRequiredCreds(gateway, creds)) {
        console.log(`[gateway-credentials] ${gateway} -> account ${data.label || data.id} (env: ${data.environment})`);
        return {
          accountId: data.id as string,
          environment: (data.environment as string) || 'sandbox',
          credentials: creds,
        };
      }
      console.warn(`[gateway-credentials] round-robin returned ${data.id} with empty creds. Falling back.`);
      return await fallbackChain(supabase, gateway, 'rr-empty', data.id as string);
    }
  } catch (e) {
    console.warn(`[gateway-credentials] Exception for ${gateway}:`, (e as Error).message);
  }
  return await fallbackChain(supabase, gateway, 'no-account');
}

/**
 * Fallback order when the round-robin pick is unusable:
 *   primary account -> first active account -> legacy site_settings.
 */
async function fallbackChain(
  supabase: any,
  gateway: GatewayKey,
  reason: string,
  skipAccountId?: string,
): Promise<ResolvedGatewayCredentials> {
  const primary = await getPrimaryAccount(supabase, gateway);
  if (primary && primary.accountId !== skipAccountId && hasRequiredCreds(gateway, primary.credentials)) {
    console.log(`[gateway-credentials] fallback (${reason}) ${gateway} -> primary account ${primary.accountId}`);
    return primary;
  }
  const accounts = await listActiveAccounts(supabase, gateway);
  for (const acc of accounts) {
    if (acc.accountId === skipAccountId) continue;
    if (hasRequiredCreds(gateway, acc.credentials)) {
      console.log(`[gateway-credentials] fallback (${reason}) ${gateway} -> active account ${acc.accountId}`);
      return acc;
    }
  }
  const legacy = await legacyCredentials(supabase, gateway);
  console.log(`[gateway-credentials] fallback (${reason}) ${gateway} -> legacy site_settings`);
  return legacy;
}

/** Loads a single gateway account row by id. Returns null if not found. */
export async function getAccountById(
  supabase: any,
  accountId: string,
): Promise<ResolvedGatewayCredentials | null> {
  const { data, error } = await supabase
    .from('gateway_accounts')
    .select('id, environment, credentials, label')
    .eq('id', accountId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    accountId: data.id as string,
    environment: (data.environment as string) || 'sandbox',
    credentials: (data.credentials || {}) as Record<string, string>,
  };
}

/** Lists all active accounts for the given gateway. */
export async function listActiveAccounts(
  supabase: any,
  gateway: GatewayKey,
): Promise<ResolvedGatewayCredentials[]> {
  const { data } = await supabase
    .from('gateway_accounts')
    .select('id, environment, credentials, label, is_primary, sort_order, created_at')
    .eq('gateway', gateway)
    .eq('active', true)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data || []).map((r: any) => ({
    accountId: r.id as string,
    environment: (r.environment as string) || 'sandbox',
    credentials: (r.credentials || {}) as Record<string, string>,
  }));
}

/**
 * Resolves credentials for an order's known gateway_account_id (saved at
 * checkout time). Falls back to legacy site_settings when the order has no
 * account binding yet (older records).
 */
export async function resolveAccountForOrder(
  supabase: any,
  gateway: GatewayKey,
  orderId: string | null | undefined,
): Promise<ResolvedGatewayCredentials> {
  if (orderId) {
    const { data: order } = await supabase
      .from('orders')
      .select('gateway_account_id')
      .eq('id', orderId)
      .maybeSingle();
    const accId = (order as any)?.gateway_account_id;
    if (accId) {
      const acc = await getAccountById(supabase, accId);
      if (acc) {
        console.log(`[gateway-credentials] order ${orderId} -> account ${acc.accountId}`);
        return acc;
      }
    }
  }
  // No bound account — fall back to first active account, then legacy settings
  const accounts = await listActiveAccounts(supabase, gateway);
  if (accounts.length > 0) return accounts[0];
  return await legacyCredentials(supabase, gateway);
}

/**
 * Iterates active accounts and returns the first one for which `validator`
 * returns true (used by webhooks to identify the issuing account by trying
 * each signature/token in turn). Falls back to legacy site_settings when no
 * account matches.
 */
export async function findAccountBySignature(
  supabase: any,
  gateway: GatewayKey,
  validator: (creds: Record<string, string>) => Promise<boolean>,
): Promise<ResolvedGatewayCredentials | null> {
  const accounts = await listActiveAccounts(supabase, gateway);
  for (const acc of accounts) {
    try {
      if (await validator(acc.credentials)) return acc;
    } catch (e) {
      console.warn(`[gateway-credentials] validator threw for account ${acc.accountId}:`, (e as Error).message);
    }
  }
  const legacy = await legacyCredentials(supabase, gateway);
  try {
    if (await validator(legacy.credentials)) return legacy;
  } catch {}
  return null;
}