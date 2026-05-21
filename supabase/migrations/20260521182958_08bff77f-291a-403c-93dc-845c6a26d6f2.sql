ALTER TABLE public.banner_slides
  ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_text text NOT NULL DEFAULT '';