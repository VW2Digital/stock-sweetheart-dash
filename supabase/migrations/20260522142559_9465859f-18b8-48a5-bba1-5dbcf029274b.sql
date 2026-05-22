ALTER TABLE public.gateway_accounts DROP CONSTRAINT IF EXISTS gateway_accounts_gateway_check;
ALTER TABLE public.gateway_accounts ADD CONSTRAINT gateway_accounts_gateway_check
  CHECK (gateway IN ('asaas','mercadopago','pagbank','pagarme','appmax','paypal'));