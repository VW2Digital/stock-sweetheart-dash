import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { TRUST_BAR_ICONS, type TrustBarItem } from '@/pages/settings/SettingsTrustBar';
import { useAITranslateBatch } from '@/hooks/useAITranslate';

interface TrustBarProps {
  items: TrustBarItem[];
  bg: string;
  speed: number;
  lang: string;
}

const TrustBar = ({ items, bg, speed, lang }: TrustBarProps) => {
  const titles = useMemo(() => items.map((i) => i.title || ''), [items]);
  const descs = useMemo(() => items.map((i) => i.desc || ''), [items]);
  const tTitles = useAITranslateBatch(titles, lang);
  const tDescs = useAITranslateBatch(descs, lang);

  return (
    <div className="border-b border-border/30 overflow-hidden" style={{ background: bg }}>
      <div className="py-3">
        <div className="flex animate-marquee whitespace-nowrap" style={{ animationDuration: `${speed}s` }}>
          {[...Array(2)].map((_, repeat) => (
            <div key={repeat} className="flex items-center shrink-0">
              <span className="text-border mx-4 md:mx-8 text-lg">|</span>
              {items.map((item, i) => {
                const Icon = TRUST_BAR_ICONS[item.icon] ?? ShieldCheck;
                const iconColor = item.color || undefined;
                return (
                  <div key={`${repeat}-${i}-${item.title}`} className="flex items-center shrink-0">
                    {i > 0 && <span className="text-border mx-4 md:mx-8 text-lg">|</span>}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="bg-card rounded-lg p-2 shrink-0 shadow-sm">
                        <Icon className={iconColor ? 'w-5 h-5' : 'w-5 h-5 text-primary'} style={iconColor ? { color: iconColor } : undefined} />
                      </div>
                      <div className="whitespace-nowrap">
                        <p className="text-xs font-bold text-foreground uppercase leading-tight">{tTitles[i] || item.title}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{tDescs[i] || item.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrustBar;
