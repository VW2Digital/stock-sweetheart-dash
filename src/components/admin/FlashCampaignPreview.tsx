import { useEffect, useMemo, useState } from 'react';
import { Zap, Clock, Flame, ShieldCheck } from 'lucide-react';
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

export function FlashCampaignPreview(p: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const accent = p.accentColor || '#ef4444';
  const bg = p.bgColor || '#0a0000';
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

  return (
    <div
      className="min-h-full text-white relative overflow-hidden"
      style={{
        background: p.bgImage
          ? `linear-gradient(rgba(0,0,0,0.75), rgba(0,0,0,0.85)), url(${p.bgImage}) center/cover`
          : `radial-gradient(ellipse at top, ${accent}33, transparent 60%), ${bg}`,
      }}
    >
      <div className="w-full py-2 text-center text-xs font-bold tracking-wider animate-pulse" style={{ background: accent }}>
        <Flame className="w-4 h-4 inline mr-1" /> {isLeadOnly ? 'INSCRIÇÕES ABERTAS' : 'OFERTA RELÂMPAGO ATIVA'}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6"
             style={{ background: `${accent}33`, color: accent, border: `1px solid ${accent}` }}>
          <Zap className="w-3.5 h-3.5" /> {p.title || 'Título da campanha'}
        </div>

        <h1 className="text-3xl md:text-5xl font-black uppercase leading-tight mb-4 drop-shadow-lg"
            style={{ textShadow: `0 0 30px ${accent}80` }}>
          {p.headline || 'OFERTA RELÂMPAGO'}
        </h1>
        <p className="text-base md:text-lg text-white/80 mb-8 max-w-2xl mx-auto">
          {p.subheadline}
        </p>

        {expired ? (
          <div className="mb-8 p-6 rounded-2xl border border-white/20 bg-white/5">
            <p className="text-xl font-bold text-white/70">Esta {isLeadOnly ? 'inscrição' : 'oferta'} expirou.</p>
          </div>
        ) : timer ? (
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2 mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
              <Clock className="w-4 h-4 animate-pulse" /> {scheduled ? 'Começa em' : 'Termina em'}
            </div>
            <div className="flex justify-center gap-2">
              {[
                { v: timer.days, l: 'dias' },
                { v: timer.hours, l: 'horas' },
                { v: timer.minutes, l: 'min' },
                { v: timer.seconds, l: 'seg' },
              ].map((u, i) => (
                <div key={i} className="rounded-xl px-3 py-2 min-w-[60px] backdrop-blur-sm border"
                     style={{ background: `${accent}1f`, borderColor: `${accent}66` }}>
                  <div className="text-2xl md:text-3xl font-black font-mono leading-none" style={{ color: accent }}>
                    {String(u.v).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] uppercase mt-1 text-white/60">{u.l}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8 p-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white/60">
            Defina a validade para visualizar o cronômetro.
          </div>
        )}

        {!isLeadOnly && p.totalAmount > 0 && (
          <div className="mb-6">
            <div className="text-xs text-white/60 uppercase tracking-wider mb-1">Por apenas</div>
            <div className="text-4xl md:text-5xl font-black mb-6" style={{ color: accent }}>
              {p.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled
          className="text-sm md:text-base font-black uppercase px-8 py-5 rounded-xl shadow-2xl"
          style={{ background: accent, color: '#000', boxShadow: `0 10px 40px ${accent}80` }}
        >
          <Flame className="w-4 h-4 inline mr-2" />
          {p.ctaText || 'GARANTIR AGORA'}
        </button>

        <div className="mt-6 flex items-center justify-center gap-3 text-[11px] text-white/50">
          <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {isLeadOnly ? 'Seus dados estão seguros' : 'Pagamento seguro'}</span>
          {!isLeadOnly && <><span>·</span><span>Estoque limitado</span></>}
        </div>
      </div>

      <FlashCampaignBlocksRenderer blocks={p.blocks || []} accent={accent} />

      {p.floatingCtaEnabled && !expired && !scheduled && (
        <div className="sticky bottom-0 inset-x-0 z-10 p-3 backdrop-blur-md border-t"
             style={{ background: 'rgba(0,0,0,0.85)', borderColor: `${accent}66` }}>
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="hidden sm:block text-sm">
              <div className="font-bold text-white">{p.title || 'Campanha'}</div>
              {remaining && (
                <div className="text-xs text-white/70 font-mono">
                  Termina em {String(remaining.hours + remaining.days * 24).padStart(2, '0')}:
                  {String(remaining.minutes).padStart(2, '0')}:
                  {String(remaining.seconds).padStart(2, '0')}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled
              className="flex-1 sm:flex-initial font-black uppercase rounded-xl px-6 py-3 text-sm"
              style={{ background: accent, color: '#000' }}
            >
              <Flame className="w-4 h-4 inline mr-2" />
              {p.floatingCtaText || p.ctaText || 'GARANTIR AGORA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
