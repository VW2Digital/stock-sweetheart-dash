-- Tabela de logos do rodapé (pagamento, segurança, transporte) editáveis pelo admin.
CREATE TABLE public.footer_logos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('payment','security','shipping')),
  label text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  link_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_footer_logos_category_sort ON public.footer_logos (category, sort_order);

ALTER TABLE public.footer_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active footer logos"
  ON public.footer_logos FOR SELECT
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage footer logos"
  ON public.footer_logos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_footer_logos_updated_at
  BEFORE UPDATE ON public.footer_logos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket público para logos do rodapé
INSERT INTO storage.buckets (id, name, public)
VALUES ('footer-logos', 'footer-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read footer-logos bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'footer-logos');

CREATE POLICY "Admins upload footer-logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'footer-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update footer-logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'footer-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete footer-logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'footer-logos' AND has_role(auth.uid(), 'admin'::app_role));