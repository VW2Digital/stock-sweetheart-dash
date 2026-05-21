import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { normalizeLng } from '@/i18n';

const SUPPORTED: Language[] = ['es', 'en'];

/**
 * Mantém o idioma em sincronia com o parâmetro ?lang= apenas quando
 * a URL realmente muda (navegação SPA). NÃO reage a mudanças do idioma
 * vindas do switcher — caso contrário um ?lang= antigo na URL sobrepunha
 * a escolha manual do utilizador.
 *
 * Também força a regeneração das tags <link hreflang> a cada mudança de rota
 * para que reflitam o pathname atual.
 */
const LanguageUrlSync = () => {
  const location = useLocation();
  const { setLang, refreshSeoTags } = useLanguage();
  const lastUrlKey = useRef<string>('');

  useEffect(() => {
    const key = `${location.pathname}${location.search}`;
    if (key === lastUrlKey.current) return;
    lastUrlKey.current = key;

    const param = new URLSearchParams(location.search).get('lang');
    const normalizedParam = normalizeLng(param || undefined);
    if (param && SUPPORTED.includes(normalizedParam)) {
      setLang(normalizedParam);
    }
    refreshSeoTags();
  }, [location.pathname, location.search, setLang, refreshSeoTags]);

  return null;
};

export default LanguageUrlSync;
