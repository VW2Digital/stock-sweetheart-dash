import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { normalizeLng } from '@/i18n';

const SUPPORTED: Language[] = ['es', 'en'];
const STORAGE_KEY = 'language';

/**
 * Sincronização bidirecional entre o idioma e a URL (?lang=).
 *
 * 1) URL → i18n: quando a URL muda e contém ?lang= válido, aplica-o.
 *    Também persiste a escolha em localStorage + cookie (i18next-browser-languagedetector
 *    já faz caching, mas reforçamos para garantir que entra mesmo via deep-link).
 *
 * 2) i18n → URL: quando o utilizador troca de idioma no switcher, atualiza
 *    o parâmetro ?lang= da URL atual (replace, sem nova entrada no histórico)
 *    para que partilhas/recargas mantenham o idioma escolhido.
 *
 * Também força a regeneração das tags <link hreflang> a cada mudança de rota.
 */
const LanguageUrlSync = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, setLang, refreshSeoTags } = useLanguage();
  const lastUrlKey = useRef<string>('');

  // 1) URL → i18n
  useEffect(() => {
    const key = `${location.pathname}${location.search}`;
    if (key === lastUrlKey.current) return;
    lastUrlKey.current = key;

    const param = new URLSearchParams(location.search).get('lang');
    if (param) {
      const normalized = normalizeLng(param);
      if (SUPPORTED.includes(normalized)) {
        setLang(normalized);
        try {
          localStorage.setItem(STORAGE_KEY, normalized);
          document.cookie = `${STORAGE_KEY}=${normalized}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        } catch {
          /* storage indisponível */
        }
      }
    }
    refreshSeoTags();
  }, [location.pathname, location.search, setLang, refreshSeoTags]);

  // 2) i18n → URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const current = params.get('lang');
    if (current === lang) return;
    params.set('lang', lang);
    const newSearch = `?${params.toString()}`;
    // Atualiza o ref para evitar loop com o efeito 1.
    lastUrlKey.current = `${location.pathname}${newSearch}`;
    navigate(
      { pathname: location.pathname, search: newSearch, hash: location.hash },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return null;
};

export default LanguageUrlSync;
