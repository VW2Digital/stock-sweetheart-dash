CREATE TABLE public.recommendation_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  session_id text,
  source_product_id uuid NOT NULL,
  recommended_product_id uuid NOT NULL,
  recommended_variation_id uuid,
  event_type text NOT NULL DEFAULT 'click',
  position integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendation_events_source ON public.recommendation_events(source_product_id);
CREATE INDEX idx_recommendation_events_recommended ON public.recommendation_events(recommended_product_id);
CREATE INDEX idx_recommendation_events_created_at ON public.recommendation_events(created_at DESC);

ALTER TABLE public.recommendation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert recommendation events"
ON public.recommendation_events FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Admins can view recommendation events"
ON public.recommendation_events FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete recommendation events"
ON public.recommendation_events FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));