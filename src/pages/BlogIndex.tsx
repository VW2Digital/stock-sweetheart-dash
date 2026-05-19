import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { BookOpen, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { INTL_LOCALES } from '@/i18n';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  cover_image: string;
  author_name: string;
  published_at: string | null;
  created_at: string;
}

export default function BlogIndex() {
  const { t, lang } = useLanguage();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  useEffect(() => {
    document.title = t('blog.pageTitle');
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id,title,slug,excerpt,cover_image,author_name,published_at,created_at')
        .eq('published', true)
        .order('published_at', { ascending: false });
      setPosts((data as BlogPost[]) || []);
      setLoading(false);
    })();
  }, [t]);

  const topics = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.author_name && set.add(p.author_name));
    return Array.from(set);
  }, [posts]);

  const filtered = useMemo(
    () => (activeTopic ? posts.filter((p) => p.author_name === activeTopic) : posts),
    [posts, activeTopic],
  );

  const formatDate = (d: string | null, fallback: string) =>
    new Date(d || fallback).toLocaleDateString(INTL_LOCALES[lang], { day: '2-digit', month: 'short', year: 'numeric' });

  const [featured, ...rest] = filtered;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Cabeçalho centralizado */}
      <section className="border-b border-border bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 py-14 sm:py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">{t('blog.title')}</h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('blog.subtitle')}
          </p>
        </div>
      </section>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-10">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">{t('blog.noPosts')}</Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-10">
            {/* Sidebar */}
            <aside className="space-y-8 lg:sticky lg:top-24 self-start">
              <div>
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">{t('blog.categories')}</p>
                <button
                  onClick={() => setActiveTopic(null)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                    activeTopic === null ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <BookOpen className="h-4 w-4" /> {t('blog.blogLabel')}
                </button>
              </div>

              {topics.length > 0 && (
                <div>
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">{t('blog.topics')}</p>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((t) => (
                      <button
                        key={t}
                        onClick={() => setActiveTopic(activeTopic === t ? null : t)}
                        className={cn(
                          'px-3 py-1.5 rounded-full border text-xs transition-colors',
                          activeTopic === t
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </aside>

            {/* Lista de posts */}
            <div className="space-y-12">
              {filtered.length === 0 ? (
                <Card className="p-10 text-center text-muted-foreground">{t('blog.noPostsForFilter')}</Card>
              ) : (
                <>
                  {/* Featured */}
                  {featured && (
                    <Link to={`/blog/${featured.slug}`} className="group grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                      <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted border border-border">
                        {featured.cover_image ? (
                          <img
                            src={featured.cover_image}
                            alt={featured.title}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <BookOpen className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            {t('blog.featured')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(featured.published_at, featured.created_at)}
                          </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                          {featured.title}
                        </h2>
                        {featured.excerpt && (
                          <p className="text-muted-foreground leading-relaxed line-clamp-3">{featured.excerpt}</p>
                        )}
                        {featured.author_name && (
                          <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                            <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-3.5 w-3.5" />
                            </span>
                            {featured.author_name}
                          </div>
                        )}
                      </div>
                    </Link>
                  )}

                  {/* Restante */}
                  {rest.map((p) => (
                    <Link
                      key={p.id}
                      to={`/blog/${p.slug}`}
                      className="group grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-12 border-t border-border"
                    >
                      <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted border border-border">
                        {p.cover_image ? (
                          <img
                            src={p.cover_image}
                            alt={p.title}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <BookOpen className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 pt-1">
                        <span className="text-xs text-muted-foreground">{formatDate(p.published_at, p.created_at)}</span>
                        <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                          {p.title}
                        </h3>
                        {p.excerpt && (
                          <p className="text-muted-foreground leading-relaxed line-clamp-3">{p.excerpt}</p>
                        )}
                        {p.author_name && (
                          <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                            <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-3.5 w-3.5" />
                            </span>
                            {p.author_name}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
