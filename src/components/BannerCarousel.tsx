import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchBannerSlides } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, ArrowRight, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const BannerCarousel = () => {
  const { t } = useLanguage();
  const [slides, setSlides] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(true);

  const [productImages, setProductImages] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchBannerSlides(true)
      .then(setSlides)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const ids = Array.from(new Set(slides.map((s: any) => s.product_id).filter(Boolean)));
    if (!ids.length) return;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, images')
        .in('id', ids as string[]);
      if (!data) return;
      const map: Record<string, string> = {};
      for (const p of data as any[]) {
        const img = Array.isArray(p.images) ? p.images[0] : null;
        if (img) map[p.id] = img;
      }
      setProductImages(map);
    })();
  }, [slides]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrent(prev => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent(c => (c - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const next = useCallback(() => {
    setDirection(1);
    setCurrent(c => (c + 1) % slides.length);
  }, [slides.length]);

  if (loading) return null;

  const effectiveSlides = slides.length > 0 ? slides : [{
    title: `${t?.('defaultBannerHeadline') || 'Feel the Balance'} | ${t?.('defaultBannerSubheadline') || 'Curated Essentials'}`,
    subtitle: t?.('defaultBannerSubtitle') || 'An exclusive curation of pieces that blend urban sophistication with minimalist design.',
    link_url: '/catalogo',
    product_id: null,
  }];

  const slide = effectiveSlides[current] || effectiveSlides[0];
  const linkTo = slide.product_id
    ? `/produto/${slide.product_id}`
    : slide.link_url || null;

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  // Derive headline / sub from the title field. Supports "Headline | Subtitle".
  const rawTitle: string = slide.title || '';
  const [headlinePart, subPart] = rawTitle.includes('|')
    ? rawTitle.split('|').map((s: string) => s.trim())
    : [rawTitle, ''];
  const ctaLabel = slide.cta_text?.trim() || t?.('shopNow') || 'Shop now';
  const productImage = slide.product_id ? productImages[slide.product_id] : null;

  const SlideContent = (
    <div className="relative w-full h-full bg-background overflow-hidden grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-center">
      {/* abstract background shape */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[20%] -right-[20%] w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] lg:-top-[10%] lg:-right-[5%] lg:w-[600px] lg:h-[600px] rounded-full opacity-60"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--muted)) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 px-6 sm:px-12 lg:px-[10%] py-8 sm:py-10 lg:py-0 text-center lg:text-left">
        <h2 className="font-bold leading-[0.95] tracking-[-0.02em] text-foreground text-[clamp(1.75rem,7vw,5rem)] mb-3 sm:mb-5">
          {headlinePart}
          {subPart && (
            <span className="block font-extralight text-muted-foreground">
              {subPart}
            </span>
          )}
        </h2>
        {slide.subtitle && (
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-md mx-auto lg:mx-0 mb-6 sm:mb-8 leading-relaxed">
            {slide.subtitle}
          </p>
        )}
        {linkTo && (
          <div className="flex items-center justify-center lg:justify-start gap-5">
            <span className="group inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-10 py-3 sm:py-5 bg-primary text-primary-foreground text-[11px] sm:text-xs font-semibold uppercase tracking-[0.15em] border border-primary transition-colors duration-500 hover:bg-background hover:text-primary">
              {ctaLabel}
              <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
            </span>
          </div>
        )}
      </div>

      {/* Visual: product card */}
      <div className="relative hidden lg:flex h-full items-center justify-center bg-muted/40">
        <div className="w-[320px] h-[420px] bg-background shadow-[30px_50px_80px_hsl(var(--foreground)/0.06)] rounded-sm p-8 flex flex-col transition-transform duration-700 hover:-translate-y-2 hover:scale-[1.02]">
          {productImage ? (
            <img
              src={productImage}
              alt={headlinePart || 'Produto'}
              className="w-full h-full object-contain"
            />
          ) : (
            <>
              <div className="w-full h-[250px] bg-muted/60 mb-5 rounded-sm flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
              </div>
              <div className="h-2 w-4/5 bg-muted/60 mb-2.5 rounded-full" />
              <div className="h-2 w-3/5 bg-muted/60 mb-2.5 rounded-full" />
              <div className="h-2 w-2/5 bg-muted/60 rounded-full" />
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative w-full overflow-hidden bg-background">
      <div className="relative min-h-[360px] sm:min-h-[440px] lg:min-h-0 lg:aspect-[1920/600]">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            {linkTo ? (
              <Link to={linkTo} className="block w-full h-full">
                {SlideContent}
              </Link>
            ) : (
              SlideContent
            )}
          </motion.div>
        </AnimatePresence>
      </div>


      {slides.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm hover:bg-background/80 rounded-full h-8 w-8 md:h-10 md:w-10 z-20"
            onClick={prev}
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm hover:bg-background/80 rounded-full h-8 w-8 md:h-10 md:w-10 z-20"
            onClick={next}
          >
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
          </Button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current
                    ? 'bg-primary w-5'
                    : 'bg-foreground/20 hover:bg-foreground/40 w-2'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BannerCarousel;
