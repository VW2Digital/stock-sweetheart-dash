import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEffect, useState } from 'react';
import { fetchSetting } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import logoImg from '@/assets/liberty-header-logo.png';

type Category = 'payment' | 'security' | 'shipping';
interface FooterLogo {
  id: string;
  category: Category;
  label: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
}

const Footer = () => {
  const { t } = useLanguage();
  const [footerText, setFooterText] = useState('');
  const [footerEmail, setFooterEmail] = useState('');
  const [footerPhone, setFooterPhone] = useState('');
  const [footerMission, setFooterMission] = useState('Nossa missão é democratizar o acesso a insumos de última geração que auxiliam no controle metabólico, no manejo do diabetes tipo 2 e na perda de peso, oferecendo soluções avançadas com eficácia comprovada e qualidade farmacêutica para todos.');
  const [logos, setLogos] = useState<FooterLogo[]>([]);

  useEffect(() => {
    Promise.all([
      fetchSetting('footer_text'),
      fetchSetting('footer_email'),
      fetchSetting('footer_phone'),
      fetchSetting('footer_mission'),
    ]).then(([text, email, phone, mission]) => {
      setFooterText(text || '');
      setFooterEmail(email || '');
      setFooterPhone(phone || '');
      if (mission) setFooterMission(mission);
    });
    supabase
      .from('footer_logos')
      .select('id, category, label, image_url, link_url, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setLogos(data as FooterLogo[]);
      });
  }, []);

  const byCategory = (c: Category) => logos.filter((l) => l.category === c);

  const renderLogo = (logo: FooterLogo, heightCls = 'max-h-10') => {
    const img = (
      <img src={logo.image_url} alt={logo.label || ''} className={`${heightCls} w-auto object-contain`} />
    );
    return logo.link_url ? (
      <a key={logo.id} href={logo.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center">{img}</a>
    ) : (
      <span key={logo.id} className="inline-flex items-center">{img}</span>
    );
  };

  const payment = byCategory('payment');
  const security = byCategory('security');
  const shipping = byCategory('shipping');

  return (
    <footer className="border-t border-border/50 bg-card mt-12">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Column 1 - Company Info */}
          <div className="space-y-3">
            <img src={logoImg} alt="Liberty Lumina" className="h-12 object-contain" />
            <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
              {(() => {
                const textOverride = t('footerTextOverride');
                const finalText = textOverride || footerText;
                return finalText ? <p>{finalText}</p> : null;
              })()}
              {(() => {
                const missionOverride = t('footerMissionOverride');
                const finalMission = missionOverride || footerMission;
                return finalMission ? <p>{finalMission}</p> : null;
              })()}
              {footerEmail && <p>{t('emailLabelShort')}: {footerEmail}</p>}
              {footerPhone && <p>{t('phoneLabelShort')}: {footerPhone}</p>}
            </div>
          </div>

          {/* Column 2 - Payment Methods */}
          {payment.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-primary md:text-foreground">{t('paymentMethodsTitle')}</h4>
              <div className="flex flex-wrap items-center gap-4">
                {payment.map((l) => renderLogo(l, 'max-h-16'))}
              </div>
            </div>
          )}

          {/* Column 3 - Security Seals */}
          {security.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-primary md:text-foreground">{t('securitySealsTitle')}</h4>
              <div className="grid grid-cols-2 items-center gap-3">
                {security.map((l) => (
                  <div key={l.id} className="flex items-center h-12">
                    {renderLogo(l, 'max-h-12')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column 4 - Shipping Methods */}
          {shipping.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-primary md:text-foreground">{t('shippingMethodsTitle')}</h4>
              <div className="grid grid-cols-2 gap-3">
                {shipping.map((l) => (
                  <div key={l.id} className="p-2 flex items-center justify-start h-12">
                    {renderLogo(l, 'max-h-10')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/50 pt-6 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t('footerCopyright', { year: new Date().getFullYear(), rights: t('allRights') })}
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            <Link to="/politica-de-privacidade" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('privacyPolicy')}
            </Link>
            <span className="text-border">|</span>
            <Link to="/termos-de-uso" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('termsOfUse')}
            </Link>
            <span className="text-border">|</span>
            <Link to="/contato" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('contact')}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
