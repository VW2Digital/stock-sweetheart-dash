
ALTER TABLE public.flash_campaigns
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS capture_lead boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_form_title text,
  ADD COLUMN IF NOT EXISTS lead_form_subtitle text,
  ADD COLUMN IF NOT EXISTS lead_cta_text text,
  ADD COLUMN IF NOT EXISTS thank_you_headline text,
  ADD COLUMN IF NOT EXISTS thank_you_message text,
  ADD COLUMN IF NOT EXISTS thank_you_bg_color text,
  ADD COLUMN IF NOT EXISTS thank_you_accent_color text,
  ADD COLUMN IF NOT EXISTS thank_you_buttons jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.flash_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.flash_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  session_id text,
  user_agent text,
  source_url text,
  converted_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flash_campaign_leads_campaign ON public.flash_campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_flash_campaign_leads_email ON public.flash_campaign_leads(LOWER(email));

ALTER TABLE public.flash_campaign_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can insert leads" ON public.flash_campaign_leads;
CREATE POLICY "anyone can insert leads"
  ON public.flash_campaign_leads
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins can read leads" ON public.flash_campaign_leads;
CREATE POLICY "admins can read leads"
  ON public.flash_campaign_leads
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins can delete leads" ON public.flash_campaign_leads;
CREATE POLICY "admins can delete leads"
  ON public.flash_campaign_leads
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
