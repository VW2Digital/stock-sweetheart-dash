CREATE TABLE IF NOT EXISTS public.reseller_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_code text NOT NULL,
  reseller_id uuid,
  event_type text NOT NULL,
  session_id text,
  user_id uuid,
  order_id uuid,
  product_name text,
  amount numeric,
  url text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_events_code_created
  ON public.reseller_events (reseller_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_events_id_type
  ON public.reseller_events (reseller_id, event_type);
CREATE INDEX IF NOT EXISTS idx_reseller_events_session
  ON public.reseller_events (session_id);
CREATE INDEX IF NOT EXISTS idx_reseller_events_created
  ON public.reseller_events (created_at DESC);

ALTER TABLE public.reseller_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert reseller events" ON public.reseller_events;
CREATE POLICY "Anyone can insert reseller events"
  ON public.reseller_events FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Admins view reseller events" ON public.reseller_events;
CREATE POLICY "Admins view reseller events"
  ON public.reseller_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete reseller events" ON public.reseller_events;
CREATE POLICY "Admins delete reseller events"
  ON public.reseller_events FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.resolve_reseller_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reseller_id IS NULL AND NEW.reseller_code IS NOT NULL THEN
    SELECT id INTO NEW.reseller_id
    FROM public.resellers
    WHERE LOWER(code) = LOWER(NEW.reseller_code)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_reseller_event_trg ON public.reseller_events;
CREATE TRIGGER resolve_reseller_event_trg
  BEFORE INSERT ON public.reseller_events
  FOR EACH ROW EXECUTE FUNCTION public.resolve_reseller_event();

NOTIFY pgrst, 'reload schema';