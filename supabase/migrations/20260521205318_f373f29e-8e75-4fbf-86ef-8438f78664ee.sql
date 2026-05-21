
DROP POLICY IF EXISTS "Anyone can view banner slides"        ON public.banner_slides;
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view products"             ON public.products;
DROP POLICY IF EXISTS "Public can view products"             ON public.products;
DROP POLICY IF EXISTS "Anyone can view variations"           ON public.product_variations;

CREATE POLICY "Anyone can view banner slides"
  ON public.banner_slides FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can view variations"
  ON public.product_variations FOR SELECT TO anon, authenticated USING (true);

UPDATE public.banner_slides bs
SET
  image_desktop = COALESCE(NULLIF(bs.image_desktop, ''), src.img, ''),
  image_tablet  = COALESCE(NULLIF(bs.image_tablet,  ''), src.img, ''),
  image_mobile  = COALESCE(NULLIF(bs.image_mobile,  ''), src.img, ''),
  updated_at    = now()
FROM (
  SELECT
    p.id AS product_id,
    COALESCE(
      NULLIF(p.images[1], ''),
      (
        SELECT COALESCE(NULLIF(v.image_url, ''), NULLIF(v.images[1], ''))
        FROM public.product_variations v
        WHERE v.product_id = p.id
          AND (NULLIF(v.image_url,'') IS NOT NULL OR array_length(v.images,1) > 0)
        ORDER BY v.created_at ASC
        LIMIT 1
      )
    ) AS img
  FROM public.products p
) src
WHERE bs.product_id = src.product_id
  AND bs.active = true
  AND (
    NULLIF(bs.image_desktop,'') IS NULL
    OR NULLIF(bs.image_tablet,'')  IS NULL
    OR NULLIF(bs.image_mobile,'')  IS NULL
  );
