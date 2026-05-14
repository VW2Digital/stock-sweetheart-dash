CREATE OR REPLACE FUNCTION public.reseller_register_payment_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _paid text[] := ARRAY['PAID','CONFIRMED','RECEIVED','RECEIVED_IN_CASH'];
BEGIN
  IF (TG_OP = 'UPDATE')
     AND NEW.reseller_code IS NOT NULL
     AND NEW.reseller_code <> ''
     AND upper(NEW.status) = ANY(_paid)
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NOT (upper(OLD.status) = ANY(_paid)) THEN

    INSERT INTO public.reseller_events
      (reseller_code, reseller_id, event_type, order_id,
       product_name, amount, user_id, metadata)
    VALUES
      (NEW.reseller_code, NEW.reseller_id, 'payment_paid', NEW.id,
       NEW.product_name, NEW.total_value, NEW.customer_user_id,
       jsonb_build_object(
         'payment_method', NEW.payment_method,
         'gateway', NEW.payment_gateway,
         'commission', NEW.reseller_commission
       ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reseller_register_payment_paid_trg ON public.orders;
CREATE TRIGGER reseller_register_payment_paid_trg
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reseller_register_payment_paid();

NOTIFY pgrst, 'reload schema';