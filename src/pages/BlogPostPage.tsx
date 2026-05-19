import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChevronRight, Clock, Facebook, Home, Linkedin, Loader2, MessageCircle, Twitter, User } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { INTL_LOCALES } from '@/i18n';
import { useAITranslateBatch } from '@/hooks/useAITranslate';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  author_name: string;
  published_at: string | null;
  created_at: string;
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useLanguage();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id,title,excerpt,content,cover_image,author_name,published_at,created_at')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (!data) { setNotFound(true); setLoading(false); return; }
      setPost(data as BlogPost);
      document.title = `${data.title} | Blog`;
      setLoading(false);
    })();
  }, [slug]);

  const readingMinutes = useMemo(() => {
    if (!post?.content) return 1;
    const text = post.content.replace(/<[^>]+>/g, ' ');
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }, [post?.content]);

  // Tradução dinâmica de título, resumo, autor e conteúdo (HTML) via IA
  const sourceTexts = useMemo(
    () => [post?.title || '', post?.excerpt || '', post?.author_name || '', post?.content || ''],
    [post?.title, post?.excerpt, post?.author_name, post?.content],
  );
  const [tTitle, tExcerpt, tAuthor, tContent] = useAITranslateBatch(sourceTexts, lang);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = tTitle || '';

  const share = (network: 'facebook' | 'twitter' | 'linkedin' | 'whatsapp') => {
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(shareText);
    const map = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      twitter: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      whatsapp: `https://api.whatsapp.com/send?text=${t}%20${u}`,
    };
    window.open(map[network], '_blank', 'noopener,noreferrer,width=600,height=520');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('blog.linkCopied'));
    } catch {
      toast.error(t('blog.copyError'));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 w-full">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notFound || !post ? (
          <div className="text-center py-20 max-w-3xl mx-auto px-4">
            <h1 className="text-2xl font-bold text-foreground">{t('blog.postNotFound')}</h1>
            <p className="text-muted-foreground mt-2">{t('blog.postNotFoundDesc')}</p>
            <Link to="/blog" className="inline-block mt-6 text-primary hover:underline">{t('blog.backToBlog')}</Link>
          </div>
        ) : (
          <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
              <Link to="/" className="hover:text-foreground transition-colors" aria-label={t('blog.home')}>
                <Home className="h-4 w-4" />
              </Link>
              <ChevronRight className="h-4 w-4" />
              <Link to="/blog" className="hover:text-foreground transition-colors">{t('blog.blogLabel')}</Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground truncate">{tTitle || post.title}</span>
            </nav>

            {/* Título */}
            <h1 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight leading-tight mb-8">
              {tTitle || post.title}
            </h1>

            {/* Autor */}
            <div className="flex items-center gap-3 mb-6">
              <span className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <User className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-foreground">{tAuthor || post.author_name || 'Liberty Pharma'}</p>
                <p className="text-xs text-muted-foreground">
                  {t('blog.publishedOn')}{' '}
                  {new Date(post.published_at || post.created_at).toLocaleDateString(INTL_LOCALES[lang], {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Tempo de leitura + share */}
            <div className="flex items-center justify-between gap-4 py-3 border-y border-border mb-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {readingMinutes} {readingMinutes === 1 ? t('blog.minuteRead') : t('blog.minutesRead')}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => share('facebook')} title={t('blog.shareFacebook')}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Facebook className="h-4 w-4" />
                </button>
                <button onClick={() => share('twitter')} title={t('blog.shareTwitter')}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Twitter className="h-4 w-4" />
                </button>
                <button onClick={() => share('linkedin')} title={t('blog.shareLinkedin')}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Linkedin className="h-4 w-4" />
                </button>
                <button onClick={() => share('whatsapp')} title={t('blog.shareWhatsapp')}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <MessageCircle className="h-4 w-4" />
                </button>
                <button onClick={copyLink} title={t('blog.copyLink')}
                  className="h-8 px-3 ml-1 inline-flex items-center justify-center rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  {t('blog.copyLink')}
                </button>
              </div>
            </div>

            {/* Capa */}
            {post.cover_image && (
              <img
                src={post.cover_image}
                alt={tTitle || post.title}
                className="w-full aspect-[16/9] object-cover rounded-lg border border-border mb-10"
              />
            )}

            {/* Conteúdo */}
            <div
              className="prose prose-neutral dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-a:text-primary prose-strong:text-foreground prose-li:text-foreground"
              dangerouslySetInnerHTML={{ __html: tContent || post.content }}
            />
            {lang !== 'pt' && !tContent && post.content && (
              <p className="text-xs text-muted-foreground mt-3 italic">{t('blog.loading')}</p>
            )}
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}
