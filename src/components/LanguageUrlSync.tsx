import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage, type Language } from '@/contexts/LanguageContext';

const SUPPORTED: Language[] = ['pt', 'es', 'en'];

/**
 * Mantém o idioma em sincronia com o parâmetro ?lang= durante a navegação SPA
 * (sem recarregar a página). Também força a atualização das tags <html lang>
 * e <link rel="alternate" hreflang> sempre que a rota muda, para que os URLs
 * em hreflang reflitam o pathname atual.
 */
const LanguageUrlSync = () => {
  const location = useLocation();
  const { lang, setLang, refreshSeoTags } = useLanguage();

  useEffect(() => {
    const param = new URLSearchParams(location.search).get('lang');
    if (param && SUPPORTED.includes(param as Language) && param !== lang) {
      setLang(param as Language);
    }
    // Reaplica hreflang/canonical-alternates para o novo pathname
    refreshSeoTags();
  }, [location.pathname, location.search, lang, setLang, refreshSeoTags]);

  return null;
};

export default LanguageUrlSync;
