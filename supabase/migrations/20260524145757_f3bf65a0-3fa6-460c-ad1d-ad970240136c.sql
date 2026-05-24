
-- ============ ORDERS ============
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Service role can update orders" ON public.orders;

CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ SITE_SETTINGS ============
DROP POLICY IF EXISTS "Anyone can view settings" ON public.site_settings;

CREATE POLICY "Public can view non-sensitive settings"
  ON public.site_settings FOR SELECT
  TO public
  USING (
    key !~* '(access_token|secret|token|sender|client_id|service_role|api_key|webhook|password|private)'
  );

CREATE POLICY "Admins can view all settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ SHIPPING_LOGS ============
DROP POLICY IF EXISTS "Authenticated users can view shipping logs" ON public.shipping_logs;

CREATE POLICY "Admins can view shipping logs"
  ON public.shipping_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ CART_ABANDONMENT_LOGS ============
DROP POLICY IF EXISTS "Service role full access" ON public.cart_abandonment_logs;

CREATE POLICY "Admins can view cart abandonment logs"
  ON public.cart_abandonment_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage cart abandonment logs"
  ON public.cart_abandonment_logs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ GATEWAY_FALLBACK_LOGS ============
DROP POLICY IF EXISTS "Anyone can insert fallback logs" ON public.gateway_fallback_logs;

CREATE POLICY "Admins can insert fallback logs"
  ON public.gateway_fallback_logs FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ RESELLER_EVENTS ============
DROP POLICY IF EXISTS "Anyone can insert reseller events" ON public.reseller_events;

CREATE POLICY "Public can insert reseller events for active resellers"
  ON public.reseller_events FOR INSERT
  TO public
  WITH CHECK (
    reseller_code IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.resellers r
      WHERE LOWER(r.code) = LOWER(reseller_events.reseller_code)
        AND r.active = true
    )
  );

-- ============ STORAGE: banner-images, product-images, testimonial-videos ============
DROP POLICY IF EXISTS "Auth users can delete banner images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update banner images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload banner images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete testimonial videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update testimonial videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload testimonial videos" ON storage.objects;

CREATE POLICY "Admins manage banner images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'banner-images' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'banner-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage product images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage testimonial videos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'testimonial-videos' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'testimonial-videos' AND has_role(auth.uid(), 'admin'::app_role));
