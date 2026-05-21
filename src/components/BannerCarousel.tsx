import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchBannerSlides } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, ArrowRight, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAITranslateBatch } from '@/hooks/useAITranslate';

const BannerCarousel = () => {
  const { t, lang } = useLanguage();
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

  const effectiveSlides = slides.length > 0 ? slides : [{
    title: `${t?.('defaultBannerHeadline') || 'Feel the Balance'} | ${t?.('defaultBannerSubheadline') || 'Curated Essentials'}`,
    subtitle: t?.('defaultBannerSubtitle') || 'An exclusive curation of pieces that blend urban sophistication with minimalist design.',
    link_url: '/catalogo',
    product_id: null,
  }];

  const slide = effectiveSlides[current] || effectiveSlides[0];

  // Derive headline / sub from the title field. Supports "Headline | Subtitle".
  const rawTitle: string = slide.title || '';
  const [headlinePartRaw, subPartRaw] = rawTitle.includes('|')
    ? rawTitle.split('|').map((s: string) => s.trim())
    : [rawTitle, ''];
  const ctaLabelRaw = slide.cta_text?.trim() || t?.('shopNow') || 'Shop now';
  const subtitleRaw = slide.subtitle || '';

  // IMPORTANT: hook must be called unconditionally, before any early return.
  const [headlinePart, subPart, ctaLabel, translatedSubtitle] = useAITranslateBatch(
    [headlinePartRaw, subPartRaw, ctaLabelRaw, subtitleRaw],
    lang,
  );

  if (loading) return null;

  const linkTo = slide.product_id
    ? `/produto/${slide.product_id}`
    : slide.link_url || null;

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  const productImage = slide.product_id ? productImages[slide.product_id] : null;


  const SlideContent = (
    <div className="relative w-full h-full bg-background overflow-hidden flex items-center border-y border-border/40">
      {/* Decorative background elements */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 w-1/3 h-full -skew-x-[15deg] translate-x-32"
        style={{ background: 'hsl(var(--primary) / 0.02)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/4 w-96 h-96 rounded-full blur-3xl"
        style={{ background: 'hsl(var(--primary) / 0.04)' }}
      />

      <div className="relative z-10 w-full mx-auto px-5 sm:px-12 lg:px-24 py-10 sm:py-14 lg:py-0 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left content column */}
        <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
            <span className="h-px w-6 sm:w-8 bg-primary" />
            <span className="text-primary uppercase tracking-[0.25em] sm:tracking-[0.3em] text-[9px] sm:text-[10px] font-bold">
              {t?.('exclusiveCatalog') || 'Exclusive Catalog'}
            </span>
          </div>

          <h2 className="text-foreground font-light tracking-tight leading-[1.1] mb-4 sm:mb-6 text-[clamp(1.6rem,7vw,4.5rem)]">
            {headlinePart}
            {subPart && (
              <>
                {' '}
                <span className="text-primary font-extralight">|</span>{' '}
                <span className="font-semibold">{subPart}</span>
              </>
            )}
          </h2>

          {subtitleRaw && (
            <p className="text-muted-foreground text-sm sm:text-lg max-w-md mb-6 sm:mb-10 leading-relaxed font-light">
              {translatedSubtitle || subtitleRaw}
            </p>
          )}

          {linkTo && (
            <span className="group inline-flex items-center gap-4 sm:gap-6 bg-primary hover:bg-primary/90 text-primary-foreground pl-6 sm:pl-10 pr-4 sm:pr-8 py-3 sm:py-5 transition-all duration-300 rounded-sm shadow-[0_15px_30px_-10px_hsl(var(--primary)/0.3)]">
              <span className="uppercase tracking-[0.2em] text-[10px] sm:text-[11px] font-bold">
                {ctaLabel}
              </span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          )}
        </div>

        {/* Right product column */}
        <div className="lg:col-span-6 hidden lg:flex justify-center lg:justify-end">
          <div className="relative group">
            {/* Layered background frame */}
            <div className="absolute -top-4 -left-4 w-full h-full border border-primary/20 translate-x-2 translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700" />

            {/* Main image container */}
            <div className="relative bg-background p-4 lg:p-6 shadow-[0_50px_100px_-20px_hsl(var(--foreground)/0.1)] border border-border/40 flex items-center justify-center overflow-hidden">
              <div className="w-[320px] lg:w-[440px] aspect-[4/3] relative flex items-center justify-center">
                {productImage ? (
                  <img
                    src={productImage}
                    alt={headlinePart || 'Produto'}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-primary" />
            </div>

            {/* Floating badge */}
            <div className="absolute -top-8 -right-8 bg-background/80 backdrop-blur-md px-6 py-4 shadow-xl border border-background/50">
              <span className="text-[9px] font-bold text-primary uppercase tracking-widest block mb-0.5">
                {t?.('availability') || 'Disponibilidade'}
              </span>
              <span className="text-xs font-semibold text-foreground">
                {t?.('inStock') || 'Em Estoque'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Carousel progress indicator */}
      {slides.length > 1 && (
        <div className="absolute bottom-8 lg:bottom-12 right-6 lg:right-24 hidden lg:flex items-center gap-3 z-20">
          {effectiveSlides.map((_, i) => (
            <div
              key={i}
              className={`h-[2px] transition-all duration-500 ${
                i === current ? 'w-16 bg-primary' : 'w-8 bg-border'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative w-full overflow-hidden bg-background">
      <div className="relative min-h-[360px] sm:min-h-[500px] lg:min-h-0 lg:aspect-[1920/600]">
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
          <button
            onClick={(e) => { e.preventDefault(); prev(); }}
            className="hidden lg:flex absolute left-4 lg:left-8 bottom-8 lg:bottom-12 w-10 h-10 border border-border items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all z-20 bg-background/80 backdrop-blur-sm"
            aria-label="Previous"
          >
            <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); next(); }}
            className="hidden lg:flex absolute left-16 lg:left-20 bottom-8 lg:bottom-12 w-10 h-10 border border-border items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all z-20 bg-background/80 backdrop-blur-sm"
            aria-label="Next"
          >
            <ChevronRight className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>

          {/* Mobile dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 lg:hidden">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); setDirection(i > current ? 1 : -1); setCurrent(i); }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current ? 'bg-primary w-5' : 'bg-foreground/20 hover:bg-foreground/40 w-2'
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
