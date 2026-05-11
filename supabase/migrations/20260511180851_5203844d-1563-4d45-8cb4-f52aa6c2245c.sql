
-- Tabela de revendedores
CREATE TABLE IF NOT EXISTS public.resellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  phone text,
  commission_percent numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resellers_code_lower ON public.resellers (LOWER(code));

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage resellers"
  ON public.resellers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_resellers_updated_at
BEFORE UPDATE ON public.resellers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Colunas em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reseller_code text,
  ADD COLUMN IF NOT EXISTS reseller_id uuid,
  ADD COLUMN IF NOT EXISTS reseller_commission numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_reseller_id ON public.orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_orders_reseller_code_lower ON public.orders (LOWER(reseller_code));

-- Trigger para resolver código → id e calcular comissão
CREATE OR REPLACE FUNCTION public.resolve_order_reseller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r public.resellers;
BEGIN
  IF NEW.reseller_code IS NOT NULL AND NEW.reseller_code <> '' THEN
    SELECT * INTO _r FROM public.resellers
      WHERE LOWER(code) = LOWER(NEW.reseller_code) AND active = true
      LIMIT 1;
    IF _r.id IS NOT NULL THEN
      NEW.reseller_id := _r.id;
      NEW.reseller_code := _r.code;
      NEW.reseller_commission := ROUND(COALESCE(NEW.total_value,0) * COALESCE(_r.commission_percent,0) / 100.0, 2);
    ELSE
      NEW.reseller_id := NULL;
      NEW.reseller_commission := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_order_reseller ON public.orders;
CREATE TRIGGER trg_resolve_order_reseller
BEFORE INSERT OR UPDATE OF reseller_code, total_value ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.resolve_order_reseller();
