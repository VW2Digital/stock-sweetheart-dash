import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Flame } from 'lucide-react';
import { FlashCampaignBlocksRenderer } from '@/components/FlashCampaignBlocksRenderer';
import type { CampaignBlock } from '@/components/admin/FlashCampaignBlocksEditor';

interface Props {
  title: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  bgColor: string;
  accentColor: string;
  bgImage: string;
  expiresAt: string;
  startsAt: string;
  mode: 'sale' | 'lead';
  totalAmount: number;
  blocks: CampaignBlock[];
  floatingCtaEnabled: boolean;
  floatingCtaText: string;
}

const splitHeadline = (h: string) => {
  const trimmed = (h || '').trim();
  if (!trimmed) return { first: 'OFERTA', rest: 'RELÂMPAGO' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], rest: '' };
  return { first: parts[0], rest: parts.slice(1).join(' ') };
};

export function FlashCampaignPreview(p: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const accent = p.accentColor || '#c9a84c';
  const accentLight = '#f0d78c';
  const bg = p.bgColor || '#0d0d0d';
  const isLeadOnly = p.mode === 'lead';

  const remaining = useMemo(() => {
    if (!p.expiresAt) return null;
    const diff = new Date(p.expiresAt).getTime() - now;
    if (diff <= 0) return null;
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  }, [p.expiresAt, now]);

  const notStartedYet = useMemo(() => {
    if (!p.startsAt) return null;
    const diff = new Date(p.startsAt).getTime() - now;
    if (diff <= 0) return null;
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  }, [p.startsAt, now]);

  const expired = !remaining && !!p.expiresAt;
  const scheduled = !!notStartedYet;
  const timer = scheduled ? notStartedYet! : remaining;
  const headlineParts = splitHeadline(p.headline);

  return (
    <div className="min-h-full w-full bg-[#050505] text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
      <div className="flex items-start justify-center p-3 pb-10">
        <div className="w-full overflow-hidden flex flex-col md:flex-row shadow-[0_0_60px_rgba(0,0,0,0.8)] border border-white/5 relative" style={{ background: bg }}>
          <div className="absolute top-0 left-0 w-full z-20">
            <div className="py-1.5 text-center" style={{ background: accent, color: '#0d0d0d' }}>
              <p className="text-[9px] font-bold tracking-[0.3em] uppercase" style={{ fontFamily: 'Sora, sans-serif' }}>
                {isLeadOnly ? 'Inscrições Abertas' : 'Oferta Relâmpago Ativa'}
              </p>
            </div>
          </div>

          <div
            className="md:w-1/2 relative min-h-[200px] md:min-h-[420px] overflow-hidden"
            style={{
              background: p.bgImage
                ? `url(${p.bgImage}) center/cover`
                : `radial-gradient(ellipse at 30% 30%, ${accent}22, transparent 60%), #1a1a1a`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-transparent to-[#0d0d0d]/40 z-[1]" />
            {!p.bgImage && (
              <div className="absolute inset-0 flex items-center justify-center z-[1]">
                <div className="text-center">
                  <Flame className="w-10 h-10 mx-auto mb-3" style={{ color: accent, opacity: 0.4 }} />
                  <div className="h-px w-10 mx-auto mb-2" style={{ background: accent }} />
                  <p className="text-[9px] tracking-[0.3em] uppercase" style={{ color: accentLight, opacity: 0.6 }}>
                    {p.title || 'Campanha'}
                  </p>
                </div>
              </div>
            )}
            <div className="absolute bottom-6 left-6 z-[2]">
              <div className="h-px w-10 mb-2" style={{ background: accent }} />
              <p className="text-white/60 text-[9px] tracking-[0.2em] uppercase">Exclusive Series</p>
            </div>
          </div>

          <div className="md:w-1/2 p-6 md:p-10 flex flex-col justify-center pt-10 md:pt-12">
            <div className="mb-5">
              <span
                className="px-3 py-1 border text-[9px] font-semibold tracking-[0.2em] uppercase rounded-sm inline-block"
                style={{ borderColor: `${accent}66`, color: accentLight, fontFamily: 'Sora, sans-serif' }}
              >
                {p.title || 'Título da campanha'}
              </span>
            </div>

            <h1
              className="text-white text-2xl md:text-3xl lg:text-4xl font-extrabold leading-[0.9] mb-4 tracking-tighter break-words"
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              {headlineParts.first}
              {headlineParts.rest && (
                <>
                  <br />
                  <span style={{ color: accent }}>{headlineParts.rest}</span>
                </>
              )}
            </h1>

            {p.subheadline && (
              <p className="text-white/60 text-sm font-light mb-6 max-w-md leading-relaxed">
                {p.subheadline}
              </p>
            )}

            {expired ? (
              <div className="mb-6 p-4 border border-white/10 bg-white/5 rounded-sm">
                <p className="text-sm font-bold text-white/70" style={{ fontFamily: 'Sora, sans-serif' }}>
                  Esta {isLeadOnly ? 'inscrição' : 'oferta'} expirou.
                </p>
              </div>
            ) : timer ? (
              <div className="mb-6">
                <p className="text-[9px] font-bold tracking-[0.3em] uppercase mb-2" style={{ color: accent, fontFamily: 'Sora, sans-serif' }}>
                  {scheduled ? 'Começa em' : 'Termina em'}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { v: timer.days, l: 'Dias' },
                    { v: timer.hours, l: 'Horas' },
                    { v: timer.minutes, l: 'Min' },
                    { v: timer.seconds, l: 'Seg' },
                  ].map((u, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className="w-full aspect-square flex items-center justify-center rounded-sm" style={{ background: accent }}>
                        <span className="text-lg md:text-2xl font-bold" style={{ color: '#0d0d0d', fontFamily: 'Sora, sans-serif' }}>
                          {String(u.v).padStart(2, '0')}
                        </span>
                      </div>
                      <span className="text-[8px] text-white/40 uppercase tracking-widest mt-1.5">{u.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-6 p-3 border border-white/10 bg-white/5 rounded-sm text-xs text-white/50">
                Defina a validade para visualizar o cronômetro.
              </div>
            )}

            <div className="space-y-3">
              {!isLeadOnly && p.totalAmount > 0 && (
                <div className="font-bold text-2xl md:text-3xl" style={{ color: accentLight, fontFamily: 'Sora, sans-serif' }}>
                  {p.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              )}
              <button
                type="button"
                disabled
                className="w-full py-4 font-bold text-xs uppercase tracking-[0.25em] rounded-sm"
                style={{
                  background: accent, color: '#0d0d0d',
                  fontFamily: 'Sora, sans-serif',
                  boxShadow: `0 15px 30px ${accent}1f`,
                }}
              >
                {p.ctaText || 'GARANTIR AGORA'}
              </button>
              <div className="flex justify-between items-center pt-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" style={{ color: accent }} />
                  <span className="text-[8px] text-white/40 uppercase tracking-widest">
                    {isLeadOnly ? 'Dados Seguros' : 'Pagamento Seguro'}
                  </span>
                </div>
                {!isLeadOnly && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-800 animate-pulse" />
                    <span className="text-[8px] text-white/40 uppercase tracking-widest">Estoque Crítico</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3">
        <FlashCampaignBlocksRenderer blocks={p.blocks || []} accent={accent} />
      </div>

      {p.floatingCtaEnabled && !expired && !scheduled && (
        <div className="sticky bottom-0 inset-x-0 z-10 px-3 py-2 backdrop-blur-md border-t" style={{ background: 'rgba(13,13,13,0.92)', borderColor: `${accent}33` }}>
          <div className="flex items-center justify-between gap-3">
            <div className="hidden sm:block">
              <div className="text-[9px] uppercase tracking-[0.25em] font-bold" style={{ color: accent, fontFamily: 'Sora, sans-serif' }}>
                {p.title || 'Campanha'}
              </div>
            </div>
            <button
              type="button"
              disabled
              className="flex-1 sm:flex-initial font-bold uppercase tracking-[0.2em] text-[11px] px-5 py-3 rounded-sm"
              style={{ background: accent, color: '#0d0d0d', fontFamily: 'Sora, sans-serif' }}
            >
              {p.floatingCtaText || p.ctaText || 'GARANTIR AGORA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
