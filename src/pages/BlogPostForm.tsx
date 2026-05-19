import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, Upload, Eye, X, Facebook, Twitter, Linkedin, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import RichTextEditor from '@/components/RichTextEditor';

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);

export default function BlogPostForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'novo';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content: '', cover_image: '',
    author_name: '', published: false,
    share_facebook_url: '', share_twitter_url: '', share_linkedin_url: '', share_whatsapp_url: '',
  });

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [preview]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data, error } = await supabase.from('blog_posts').select('*').eq('id', id).maybeSingle();
      if (error || !data) { toast.error('Post não encontrado'); navigate('/admin/blog'); return; }
      setForm({
        title: data.title, slug: data.slug, excerpt: data.excerpt || '',
        content: data.content || '', cover_image: data.cover_image || '',
        author_name: data.author_name || '', published: !!data.published,
        share_facebook_url: (data as any).share_facebook_url || '',
        share_twitter_url: (data as any).share_twitter_url || '',
        share_linkedin_url: (data as any).share_linkedin_url || '',
        share_whatsapp_url: (data as any).share_whatsapp_url || '',
      });
      setLoading(false);
    })();
  }, [id, isEdit, navigate]);

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const handleTitleChange = (v: string) => {
    update({ title: v, ...(isEdit ? {} : { slug: slugify(v) }) });
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `blog/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('banner-images').upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('banner-images').getPublicUrl(path);
      update({ cover_image: data.publicUrl });
      toast.success('Imagem enviada');
    } catch (e: any) {
      toast.error('Erro ao enviar imagem: ' + (e?.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Título obrigatório');
    if (!form.slug.trim()) return toast.error('Slug obrigatório');
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error('Não autenticado'); }

    const payload: any = {
      title: form.title.trim(),
      slug: slugify(form.slug),
      excerpt: form.excerpt,
      content: form.content,
      cover_image: form.cover_image,
      author_name: form.author_name,
      published: form.published,
      published_at: form.published ? (new Date()).toISOString() : null,
      share_facebook_url: form.share_facebook_url.trim() || null,
      share_twitter_url: form.share_twitter_url.trim() || null,
      share_linkedin_url: form.share_linkedin_url.trim() || null,
      share_whatsapp_url: form.share_whatsapp_url.trim() || null,
    };

    if (isEdit) {
      const { error } = await supabase.from('blog_posts').update(payload).eq('id', id!);
      if (error) { setSaving(false); return toast.error('Erro: ' + error.message); }
      toast.success('Post atualizado');
    } else {
      payload.user_id = user.id;
      const { error } = await supabase.from('blog_posts').insert(payload);
      if (error) { setSaving(false); return toast.error('Erro: ' + error.message); }
      toast.success('Post criado');
    }
    setSaving(false);
    navigate('/admin/blog');
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" onClick={() => navigate('/admin/blog')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPreview(true)} className="gap-2">
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{isEdit ? 'Editar post' : 'Novo post'}</h1>
        <p className="text-sm text-muted-foreground">Preencha o conteúdo à esquerda e os metadados à direita.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        {/* Coluna principal: conteúdo */}
        <Card className="p-5 sm:p-6 space-y-5 min-w-0">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Título do post"
              className="text-lg font-semibold h-12"
            />
          </div>

          <div className="space-y-2">
            <Label>Resumo</Label>
            <Textarea
              value={form.excerpt}
              onChange={(e) => update({ excerpt: e.target.value })}
              rows={2}
              placeholder="Resumo curto exibido na listagem"
            />
          </div>

          <div className="space-y-2">
            <Label>Conteúdo</Label>
            <RichTextEditor
              value={form.content}
              onChange={(v) => update({ content: v })}
              placeholder="Escreva o conteúdo do post..."
            />
          </div>
        </Card>

        {/* Coluna lateral: metadados */}
        <div className="space-y-5 lg:sticky lg:top-20">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="cursor-pointer">Publicado</Label>
                <p className="text-xs text-muted-foreground">Visível em /blog</p>
              </div>
              <Switch checked={form.published} onCheckedChange={(v) => update({ published: v })} />
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <Label>Slug (URL)</Label>
              <Input value={form.slug} onChange={(e) => update({ slug: e.target.value })} placeholder="meu-post" />
              <p className="text-xs text-muted-foreground truncate">/blog/{form.slug || 'meu-post'}</p>
            </div>

            <div className="space-y-2">
              <Label>Autor</Label>
              <Input value={form.author_name} onChange={(e) => update({ author_name: e.target.value })} placeholder="Nome do autor" />
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <Label>Imagem de capa</Label>
            {form.cover_image && (
              <img
                src={form.cover_image}
                alt="capa"
                className="w-full aspect-[16/9] object-cover rounded border border-border"
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded border border-border cursor-pointer hover:bg-muted text-sm">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {form.cover_image ? 'Trocar' : 'Enviar imagem'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                />
              </label>
              {form.cover_image && (
                <Button variant="ghost" size="sm" onClick={() => update({ cover_image: '' })}>Remover</Button>
              )}
            </div>
            <Input
              value={form.cover_image}
              onChange={(e) => update({ cover_image: e.target.value })}
              placeholder="ou cole a URL"
            />
          </Card>

          <Card className="p-5 space-y-4">
            <div>
              <Label>Links de compartilhamento</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Opcional. Se preenchidos, substituem o link padrão de cada botão de partilha do post.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-2 text-muted-foreground">
                <Facebook className="h-3.5 w-3.5" /> Facebook
              </Label>
              <Input
                value={form.share_facebook_url}
                onChange={(e) => update({ share_facebook_url: e.target.value })}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-2 text-muted-foreground">
                <Twitter className="h-3.5 w-3.5" /> Twitter / X
              </Label>
              <Input
                value={form.share_twitter_url}
                onChange={(e) => update({ share_twitter_url: e.target.value })}
                placeholder="https://twitter.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-2 text-muted-foreground">
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn
              </Label>
              <Input
                value={form.share_linkedin_url}
                onChange={(e) => update({ share_linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Label>
              <Input
                value={form.share_whatsapp_url}
                onChange={(e) => update({ share_whatsapp_url: e.target.value })}
                placeholder="https://wa.me/..."
              />
            </div>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/blog')}>Cancelar</Button>
          </div>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-8 py-3 border-b border-border bg-card/95 backdrop-blur">
            <div className="text-xs sm:text-sm text-muted-foreground truncate">
              Preview · /blog/{form.slug || 'meu-post'}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPreview(false)} className="gap-2">
              <X className="h-4 w-4" /> Fechar (Esc)
            </Button>
          </div>
          <article className="mx-auto max-w-3xl px-4 sm:px-8 py-8 sm:py-12">
            {form.cover_image && (
              <img
                src={form.cover_image}
                alt={form.title}
                className="w-full aspect-[16/9] object-cover rounded-lg mb-8 border border-border"
              />
            )}
            <h1 className="text-3xl sm:text-5xl font-bold text-foreground leading-tight mb-4">
              {form.title || 'Sem título'}
            </h1>
            {form.author_name && (
              <p className="text-sm text-muted-foreground mb-6">Por {form.author_name}</p>
            )}
            {form.excerpt && (
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{form.excerpt}</p>
            )}
            <div
              className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground prose-a:text-primary prose-strong:text-foreground"
              dangerouslySetInnerHTML={{ __html: form.content || '<p class="text-muted-foreground">Sem conteúdo ainda...</p>' }}
            />
          </article>
        </div>
      )}
    </div>
  );
}
