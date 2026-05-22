import { useState } from 'react';
import { ListChecks, Gift, ShieldCheck, Users, ChevronDown, Star } from 'lucide-react';
import type { CampaignBlock } from '@/components/admin/FlashCampaignBlocksEditor';

interface Props {
  blocks: CampaignBlock[];
  accent: string;
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}
function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function VideoEmbed({ url }: { url: string }) {
  if (!url) return null;
  const yt = getYouTubeId(url);
  if (yt) {
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl">
        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yt}`}
                title="Vídeo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen />
      </div>
    );
  }
  const vm = getVimeoId(url);
  if (vm) {
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl">
        <iframe className="w-full h-full" src={`https://player.vimeo.com/video/${vm}`}
                title="Vídeo" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      </div>
    );
  }
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
    return (
      <video className="w-full rounded-xl border border-white/10 shadow-2xl" src={url} controls playsInline />
    );
  }
  return null;
}

export function FlashCampaignBlocksRenderer({ blocks, accent }: Props) {
  if (!blocks?.length) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 pb-16 space-y-12">
      {blocks.filter(b => b.visible !== false).map((b) => (
        <section key={b.id}>
          <BlockView block={b} accent={accent} />
        </section>
      ))}
    </div>
  );
}

function BlockView({ block, accent }: { block: CampaignBlock; accent: string }) {
  const d = block.data || {};
  switch (block.type) {
    case 'video':
      return (
        <div>
          {d.title && <h2 className="text-2xl md:text-3xl font-bold mb-4 text-center">{d.title}</h2>}
          <VideoEmbed url={d.url} />
        </div>
      );
    case 'image':
      return (
        <figure>
          {d.url && <img src={d.url} alt={d.alt || ''} className="w-full rounded-xl border border-white/10 shadow-2xl" loading="lazy" />}
          {d.caption && <figcaption className="text-center text-sm text-white/60 mt-2">{d.caption}</figcaption>}
        </figure>
      );
    case 'benefits':
      return (
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">{d.title}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {(d.items || []).map((it: string, i: number) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
                <ListChecks className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <span className="text-white/90">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case 'bonus':
      return (
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">{d.title}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {(d.items || []).map((it: any, i: number) => (
              <div key={i} className="rounded-xl border bg-white/5 p-5 flex items-center gap-4" style={{ borderColor: `${accent}66` }}>
                <Gift className="w-8 h-8 flex-shrink-0" style={{ color: accent }} />
                <div className="flex-1">
                  <div className="font-bold text-white">{it.name}</div>
                  {it.value && <div className="text-sm text-white/60">Valor: <span className="line-through">{it.value}</span></div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'guarantee':
      return (
        <div className="rounded-2xl border bg-white/5 p-6 md:p-8 text-center" style={{ borderColor: `${accent}66` }}>
          <ShieldCheck className="w-12 h-12 mx-auto mb-3" style={{ color: accent }} />
          <h2 className="text-2xl font-bold mb-2">{d.title}</h2>
          {d.days != null && (
            <div className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-3"
                 style={{ background: `${accent}33`, color: accent }}>
              {d.days} dias de garantia
            </div>
          )}
          <p className="text-white/80 max-w-xl mx-auto">{d.text}</p>
        </div>
      );
    case 'testimonials':
      return (
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">{d.title}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(d.items || []).map((it: any, i: number) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex gap-1 mb-2">
                  {Array.from({ length: it.rating || 5 }).map((_, k) => (
                    <Star key={k} className="w-4 h-4 fill-current" style={{ color: accent }} />
                  ))}
                </div>
                <p className="text-white/90 italic mb-3">"{it.text}"</p>
                <div className="flex items-center gap-2">
                  {it.avatar && <img src={it.avatar} alt={it.name} className="w-8 h-8 rounded-full object-cover" loading="lazy" />}
                  <span className="font-bold text-sm">{it.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'social_proof':
      return (
        <div className="text-center rounded-2xl border border-white/10 bg-white/5 p-6">
          <Users className="w-10 h-10 mx-auto mb-2" style={{ color: accent }} />
          <div className="text-3xl md:text-4xl font-black" style={{ color: accent }}>{d.title}</div>
          {d.subtitle && <div className="text-white/70 mt-1">{d.subtitle}</div>}
        </div>
      );
    case 'faq':
      return (
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">{d.title}</h2>
          <div className="space-y-2">
            {(d.items || []).map((it: any, i: number) => (
              <FaqItem key={i} q={it.q} a={it.a} accent={accent} />
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

function FaqItem({ q, a, accent }: { q: string; a: string; accent: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
        <span className="font-medium text-white">{q}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: accent }} />
      </button>
      {open && <div className="px-4 pb-4 text-white/80 text-sm whitespace-pre-line">{a}</div>}
    </div>
  );
}
