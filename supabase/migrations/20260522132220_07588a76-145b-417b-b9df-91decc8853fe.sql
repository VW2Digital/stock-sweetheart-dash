-- Allow 'appmax' as a valid gateway in gateway_accounts
ALTER TABLE public.gateway_accounts
  DROP CONSTRAINT IF EXISTS gateway_accounts_gateway_check;

ALTER TABLE public.gateway_accounts
  ADD CONSTRAINT gateway_accounts_gateway_check
  CHECK (gateway = ANY (ARRAY['asaas'::text, 'mercadopago'::text, 'pagbank'::text, 'pagarme'::text, 'appmax'::text]));