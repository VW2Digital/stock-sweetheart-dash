import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChevronRight, Clock, Facebook, Home, Linkedin, Loader2, MessageCircle, Twitter, User } from 'lucide-react';
import { toast } from 'sonner';

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

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = post?.title || '';

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
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar');
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
            <h1 className="text-2xl font-bold text-foreground">Post não encontrado</h1>
            <p className="text-muted-foreground mt-2">Ele pode ter sido removido ou ainda não foi publicado.</p>
            <Link to="/blog" className="inline-block mt-6 text-primary hover:underline">Voltar ao blog</Link>
          </div>
        ) : (
          <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
              <Link to="/" className="hover:text-foreground transition-colors" aria-label="Início">
                <Home className="h-4 w-4" />
              </Link>
              <ChevronRight className="h-4 w-4" />
              <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground truncate">{post.title}</span>
            </nav>

            {/* Título */}
            <h1 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight leading-tight mb-8">
              {post.title}
            </h1>

            {/* Autor */}
            <div className="flex items-center gap-3 mb-6">
              <span className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <User className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-foreground">{post.author_name || 'Liberty Pharma'}</p>
                <p className="text-xs text-muted-foreground">
                  Publicado em{' '}
                  {new Date(post.published_at || post.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Tempo de leitura + share */}
            <div className="flex items-center justify-between gap-4 py-3 border-y border-border mb-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {readingMinutes} {readingMinutes === 1 ? 'minuto' : 'minutos'} de leitura
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => share('facebook')} title="Compartilhar no Facebook"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Facebook className="h-4 w-4" />
                </button>
                <button onClick={() => share('twitter')} title="Compartilhar no Twitter"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Twitter className="h-4 w-4" />
                </button>
                <button onClick={() => share('linkedin')} title="Compartilhar no LinkedIn"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Linkedin className="h-4 w-4" />
                </button>
                <button onClick={() => share('whatsapp')} title="Compartilhar no WhatsApp"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <MessageCircle className="h-4 w-4" />
                </button>
                <button onClick={copyLink} title="Copiar link"
                  className="h-8 px-3 ml-1 inline-flex items-center justify-center rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  Copiar link
                </button>
              </div>
            </div>

            {/* Capa */}
            {post.cover_image && (
              <img
                src={post.cover_image}
                alt={post.title}
                className="w-full aspect-[16/9] object-cover rounded-lg border border-border mb-10"
              />
            )}

            {/* Conteúdo */}
            <div
              className="prose prose-neutral dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-a:text-primary prose-strong:text-foreground prose-li:text-foreground"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}
