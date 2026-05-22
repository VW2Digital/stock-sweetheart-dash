import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Send, Flame, Lock } from 'lucide-react';
import { FlashCampaignBlocksRenderer } from '@/components/FlashCampaignBlocksRenderer';
import type { CampaignBlock } from '@/components/admin/FlashCampaignBlocksEditor';

const formatPhone = (v: string) => {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

interface Campaign {
  id: string; slug: string; title: string; headline: string; subheadline: string;
  cta_text: string; payment_link_id: string; expires_at: string;
  starts_at: string | null;
  background_image: string | null; bg_color: string | null; accent_color: string | null; active: boolean;
  mode: string; capture_lead: boolean;
  lead_form_title: string | null; lead_form_subtitle: string | null; lead_cta_text: string | null;
  blocks: CampaignBlock[] | null;
  floating_cta_enabled: boolean | null;
  floating_cta_text: string | null;
  banner_logo_url: string | null;
  cta_url: string | null;
}
interface PaymentLink { id: string; slug: string; amount: number; title: string; }

const SESSION_KEY = 'flash_session_id';
const getSessionId = () => {
  let s = sessionStorage.getItem(SESSION_KEY);
  if (!s) { s = crypto.randomUUID(); sessionStorage.setItem(SESSION_KEY, s); }
  return s;
};

// Split headline into 2 parts for the noir style: first word / rest
const splitHeadline = (h: string) => {
  const trimmed = (h || '').trim();
  if (!trimmed) return { first: 'OFERTA', rest: 'RELÂMPAGO' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], rest: '' };
  return { first: parts[0], rest: parts.slice(1).join(' ') };
};

export default function FlashCampaignPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [submittingLead, setSubmittingLead] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: c } = await supabase.from('flash_campaigns' as any)
        .select('*').eq('slug', slug).eq('active', true).maybeSingle();
      if (!c) { setLoading(false); return; }
      const camp = c as unknown as Campaign;
      setCampaign(camp);
      if (camp.payment_link_id) {
        const { data: l } = await supabase.from('payment_links')
          .select('id,slug,amount,title').eq('id', camp.payment_link_id).maybeSingle();
        if (l) setLink(l as PaymentLink);
      }
      const { error: viewErr } = await supabase.from('flash_campaign_events' as any).insert({
        campaign_id: camp.id, event_type: 'view', session_id: getSessionId(),
      });
      if (viewErr) console.error('[flash] view insert error:', viewErr);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = useMemo(() => {
    if (!campaign) return null;
    const diff = new Date(campaign.expires_at).getTime() - now;
    if (diff <= 0) return null;
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  }, [campaign, now]);

  const notStartedYet = useMemo(() => {
    if (!campaign?.starts_at) return null;
    const diff = new Date(campaign.starts_at).getTime() - now;
    if (diff <= 0) return null;
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  }, [campaign, now]);

  const isLeadOnly = campaign?.mode === 'lead';
  const needsLeadCapture = isLeadOnly || !!campaign?.capture_lead;

  const onCta = async () => {
    if (!campaign) return;
    if (needsLeadCapture) {
      setShowLeadForm(true);
      setTimeout(() => document.getElementById('lead-form')?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }
    await goToCheckout();
  };

  const goToCheckout = async () => {
    if (!campaign || !link) return;
    await supabase.from('flash_campaign_events' as any).insert({
      campaign_id: campaign.id, event_type: 'click', session_id: getSessionId(),
    });
    sessionStorage.setItem('flash_campaign_pending', JSON.stringify({
      campaign_id: campaign.id, slug: campaign.slug, ts: Date.now(),
    }));
    navigate(`/pagar/${link.slug}`);
  };

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;
    if (!leadName.trim() || !leadEmail.trim() || !leadPhone.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setSubmittingLead(true);
    const { error } = await supabase.from('flash_campaign_leads' as any).insert({
      campaign_id: campaign.id,
      name: leadName.trim(),
      email: leadEmail.trim().toLowerCase(),
      phone: leadPhone.trim(),
      session_id: getSessionId(),
      user_agent: navigator.userAgent,
      source_url: window.location.href,
    });
    setSubmittingLead(false);
    if (error) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
      return;
    }
    sessionStorage.setItem(`flash_lead_${campaign.id}`, JSON.stringify({
      name: leadName.trim(), email: leadEmail.trim(), phone: leadPhone.trim(),
    }));
    if (isLeadOnly) {
      navigate(`/relampago/${campaign.slug}/obrigado`);
    } else {
      await goToCheckout();
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Carregando...</div>;
  }
  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white p-6 text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>Campanha não encontrada</h1>
          <p className="text-white/60">Esta oferta pode ter expirado ou foi desativada.</p>
        </div>
      </div>
    );
  }

  const accent = campaign.accent_color || '#c9a84c';
  const accentLight = '#f0d78c';
  const bg = campaign.bg_color || '#0d0d0d';
  const expired = !remaining;
  const scheduled = !!notStartedYet;
  const timer = scheduled ? notStartedYet! : remaining;
  const headlineParts = splitHeadline(campaign.headline);

  return (
    <div
      className="min-h-screen w-full bg-[#050505] text-white"
      style={{ fontFamily: 'Manrope, sans-serif' }}
    >
      <div className="flex items-start justify-center p-3 md:p-8 pb-24">
        <div
          className="max-w-6xl w-full overflow-hidden flex flex-col md:flex-row shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/5 relative"
          style={{ background: bg }}
        >
          {/* Status Bar */}
          <div className="absolute top-0 left-0 w-full z-20">
            <div className="py-1.5 text-center" style={{ background: accent, color: '#0d0d0d' }}>
              <p className="text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase" style={{ fontFamily: 'Sora, sans-serif' }}>
                {isLeadOnly ? 'Inscrições Abertas' : 'Oferta Relâmpago Ativa'}
              </p>
            </div>
          </div>

          {/* Left visual */}
          <div
            className="md:w-1/2 relative min-h-[280px] md:min-h-[700px] overflow-hidden"
            style={{
              background: campaign.background_image
                ? `url(${campaign.background_image}) center/cover`
                : `radial-gradient(ellipse at 30% 30%, ${accent}22, transparent 60%), #1a1a1a`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-transparent to-[#0d0d0d]/40 z-[1]" />
            {!campaign.background_image && (
              <div className="absolute inset-0 flex items-center justify-center z-[1] pointer-events-none">
                <div className="text-center">
                  <Flame className="w-16 h-16 mx-auto mb-4" style={{ color: accent, opacity: 0.4 }} />
                  <div className="h-px w-12 mx-auto mb-3" style={{ background: accent }} />
                  <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: accentLight, opacity: 0.6 }}>
                    {campaign.title}
                  </p>
                </div>
              </div>
            )}
            <div className="absolute bottom-8 md:bottom-12 left-8 md:left-12 z-[2]">
              <div className="h-px w-16 mb-4" style={{ background: accent }} />
              <p className="text-white/60 text-[10px] tracking-[0.2em] uppercase">
                Exclusive Series
              </p>
            </div>
          </div>

          {/* Right offer */}
          <div className="md:w-1/2 p-8 md:p-16 lg:p-20 flex flex-col justify-center relative pt-12 md:pt-20">
            {/* Campaign badge */}
            <div className="mb-6 md:mb-8">
              <span
                className="px-4 py-1.5 border text-[10px] font-semibold tracking-[0.2em] uppercase rounded-sm inline-block"
                style={{ borderColor: `${accent}66`, color: accentLight, fontFamily: 'Sora, sans-serif' }}
              >
                {campaign.title}
              </span>
            </div>

            {/* Headline */}
            <h1
              className="text-white text-3xl md:text-4xl lg:text-5xl font-extrabold leading-[0.9] mb-6 tracking-tighter"
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

            {/* Subheadline */}
            {campaign.subheadline && (
              <p className="text-white/60 text-base md:text-lg font-light mb-10 md:mb-12 max-w-md leading-relaxed">
                {campaign.subheadline}
              </p>
            )}

            {/* Timer */}
            {scheduled || (!expired && timer) ? (
              <div className="mb-10 md:mb-12">
                <p className="text-[10px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: accent, fontFamily: 'Sora, sans-serif' }}>
                  {scheduled ? 'Começa em' : 'Termina em'}
                </p>
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  {[
                    { v: timer!.days, l: 'Dias' },
                    { v: timer!.hours, l: 'Horas' },
                    { v: timer!.minutes, l: 'Minutos' },
                    { v: timer!.seconds, l: 'Segundos' },
                  ].map((u, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className="w-full aspect-square flex items-center justify-center rounded-sm" style={{ background: accent }}>
                        <span className="text-2xl md:text-3xl font-bold" style={{ color: '#0d0d0d', fontFamily: 'Sora, sans-serif' }}>
                          {String(u.v).padStart(2, '0')}
                        </span>
                      </div>
                      <span className="text-[8px] md:text-[9px] text-white/40 uppercase tracking-widest mt-2">{u.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : expired ? (
              <div className="mb-10 p-5 border border-white/10 bg-white/5 rounded-sm">
                <p className="text-lg font-bold text-white/70" style={{ fontFamily: 'Sora, sans-serif' }}>
                  Esta {isLeadOnly ? 'inscrição' : 'oferta'} expirou.
                </p>
              </div>
            ) : null}

            {/* Price + CTA */}
            <div className="space-y-5">
              {!isLeadOnly && link && (
                <div className="flex items-baseline gap-4">
                  <span className="font-bold text-3xl md:text-4xl" style={{ color: accentLight, fontFamily: 'Sora, sans-serif' }}>
                    {Number(link.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              )}

              {!showLeadForm && (
                <button
                  type="button"
                  disabled={expired || scheduled || (!isLeadOnly && !link)}
                  onClick={onCta}
                  className="w-full py-5 hover:brightness-110 transition-all duration-300 font-bold text-sm uppercase tracking-[0.25em] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
                  style={{
                    background: accent,
                    color: '#0d0d0d',
                    fontFamily: 'Sora, sans-serif',
                    boxShadow: `0 15px 30px ${accent}1f`,
                  }}
                >
                  {campaign.cta_text}
                </button>
              )}

              {/* Trust */}
              <div className="flex justify-between items-center px-1 pt-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" style={{ color: accent }} />
                  <span className="text-[9px] text-white/40 uppercase tracking-widest">
                    {isLeadOnly ? 'Dados Seguros' : 'Pagamento Seguro'}
                  </span>
                </div>
                {!isLeadOnly && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-800 animate-pulse" />
                    <span className="text-[9px] text-white/40 uppercase tracking-widest">Estoque Crítico</span>
                  </div>
                )}
              </div>
            </div>

            {/* Lead form */}
            {showLeadForm && !expired && !scheduled && (
              <form
                id="lead-form"
                onSubmit={submitLead}
                className="mt-8 border border-white/10 bg-white/5 p-6 space-y-4 rounded-sm"
              >
                <div>
                  <h3 className="text-xl font-bold mb-1 text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
                    {campaign.lead_form_title || 'Garanta sua vaga'}
                  </h3>
                  <p className="text-xs text-white/60">
                    {campaign.lead_form_subtitle || 'Preencha seus dados para continuar'}
                  </p>
                </div>
                <div>
                  <Label className="text-[10px] text-white/60 uppercase tracking-widest">Nome completo</Label>
                  <Input value={leadName} onChange={e => setLeadName(e.target.value)}
                    className="bg-black/40 border-white/10 text-white placeholder:text-white/30 rounded-sm mt-1"
                    placeholder="Seu nome" required />
                </div>
                <div>
                  <Label className="text-[10px] text-white/60 uppercase tracking-widest">Email</Label>
                  <Input type="email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)}
                    className="bg-black/40 border-white/10 text-white placeholder:text-white/30 rounded-sm mt-1"
                    placeholder="voce@email.com" required />
                </div>
                <div>
                  <Label className="text-[10px] text-white/60 uppercase tracking-widest">WhatsApp</Label>
                  <Input value={leadPhone} onChange={e => setLeadPhone(formatPhone(e.target.value))}
                    inputMode="tel" maxLength={15}
                    className="bg-black/40 border-white/10 text-white placeholder:text-white/30 rounded-sm mt-1"
                    placeholder="(11) 99999-9999" required />
                </div>
                <button type="submit" disabled={submittingLead}
                  className="w-full py-4 font-bold text-sm uppercase tracking-[0.25em] rounded-sm hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: accent, color: '#0d0d0d', fontFamily: 'Sora, sans-serif' }}>
                  <Send className="w-3.5 h-3.5" />
                  {submittingLead ? 'Enviando...' : (campaign.lead_cta_text || (isLeadOnly ? 'Quero me inscrever' : 'Continuar'))}
                </button>
                <div className="flex items-center justify-center gap-2 text-[9px] text-white/40 uppercase tracking-widest pt-1">
                  <Lock className="w-3 h-3" />
                  Dados protegidos
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Extra blocks (video, benefits, FAQ etc) */}
      <div className="max-w-6xl mx-auto px-3 md:px-8">
        <FlashCampaignBlocksRenderer blocks={(campaign.blocks || []) as CampaignBlock[]} accent={accent} />
      </div>

      {/* Floating CTA */}
      {campaign.floating_cta_enabled && !expired && !scheduled && (
        <div
          className="fixed bottom-0 inset-x-0 z-50 px-4 py-3 backdrop-blur-md border-t"
          style={{ background: 'rgba(13,13,13,0.92)', borderColor: `${accent}33` }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: accent, fontFamily: 'Sora, sans-serif' }}>
                {campaign.title}
              </div>
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
              onClick={onCta}
              className="flex-1 sm:flex-initial font-bold uppercase tracking-[0.2em] text-xs px-6 py-3.5 rounded-sm hover:brightness-110 transition-all active:scale-[0.98]"
              style={{ background: accent, color: '#0d0d0d', fontFamily: 'Sora, sans-serif' }}
            >
              {campaign.floating_cta_text || campaign.cta_text}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
