import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'cookie_consent_accepted';

export default function CookieConsent() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!accepted) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] animate-in slide-in-from-bottom-4 duration-500">
      <div className="mx-4 mb-4 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-4 sm:p-5 max-w-4xl sm:mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 text-sm text-card-foreground leading-relaxed">
            {t('cookieBannerText')}
            <Link
              to="/politica-de-privacidade"
              className="ml-1 font-medium text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              onClick={() => setVisible(false)}
            >
              {t('cookieBannerPrivacy')}
            </Link>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleAccept}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              {t('cookieBannerAccept')}
            </button>
            <button
              onClick={handleAccept}
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
