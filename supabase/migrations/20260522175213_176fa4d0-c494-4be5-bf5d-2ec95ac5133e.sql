ALTER TABLE public.flash_campaigns
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS floating_cta_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS floating_cta_text text;