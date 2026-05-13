
-- A coluna discount_mode já existe; garantir idempotência e recarregar cache
ALTER TABLE public.flash_campaigns ADD COLUMN IF NOT EXISTS discount_mode text;
ALTER TABLE public.flash_campaigns ADD COLUMN IF NOT EXISTS discount_value numeric;
ALTER TABLE public.flash_campaigns ADD COLUMN IF NOT EXISTS promo_price numeric;
ALTER TABLE public.flash_campaigns ADD COLUMN IF NOT EXISTS max_installments integer;
ALTER TABLE public.flash_campaigns ADD COLUMN IF NOT EXISTS pix_discount integer;

NOTIFY pgrst, 'reload schema';
