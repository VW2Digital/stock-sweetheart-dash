
ALTER TABLE public.flash_campaigns
  ADD COLUMN IF NOT EXISTS banner_logo_url text,
  ADD COLUMN IF NOT EXISTS cta_url text;
