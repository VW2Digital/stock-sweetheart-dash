import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
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
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content: '', cover_image: '',
    author_name: '', published: false,
  });

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data, error } = await supabase.from('blog_posts').select('*').eq('id', id).maybeSingle();
      if (error || !data) { toast.error('Post não encontrado'); navigate('/admin/blog'); return; }
      setForm({
        title: data.title, slug: data.slug, excerpt: data.excerpt || '',
        content: data.content || '', cover_image: data.cover_image || '',
        author_name: data.author_name || '', published: !!data.published,
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
    <div className="space-y-4 w-full">
      <Button variant="ghost" onClick={() => navigate('/admin/blog')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <Card className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">{isEdit ? 'Editar post' : 'Novo post'}</h1>

        <div className="space-y-2">
          <Label>Título</Label>
          <Input value={form.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Título do post" />
        </div>

        <div className="space-y-2">
          <Label>Slug (URL)</Label>
          <Input value={form.slug} onChange={(e) => update({ slug: e.target.value })} placeholder="meu-post" />
          <p className="text-xs text-muted-foreground">URL final: /blog/{form.slug || 'meu-post'}</p>
        </div>

        <div className="space-y-2">
          <Label>Autor</Label>
          <Input value={form.author_name} onChange={(e) => update({ author_name: e.target.value })} placeholder="Nome do autor" />
        </div>

        <div className="space-y-2">
          <Label>Resumo</Label>
          <Textarea value={form.excerpt} onChange={(e) => update({ excerpt: e.target.value })} rows={2} placeholder="Resumo curto exibido na listagem" />
        </div>

        <div className="space-y-2">
          <Label>Imagem de capa</Label>
          <div className="flex items-center gap-3 flex-wrap">
            {form.cover_image && (
              <img src={form.cover_image} alt="capa" className="w-32 h-20 object-cover rounded border border-border" />
            )}
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded border border-border cursor-pointer hover:bg-muted text-sm">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {form.cover_image ? 'Trocar imagem' : 'Enviar imagem'}
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
          <Input value={form.cover_image} onChange={(e) => update({ cover_image: e.target.value })} placeholder="ou cole a URL" />
        </div>

        <div className="space-y-2">
          <Label>Conteúdo</Label>
          <RichTextEditor value={form.content} onChange={(v) => update({ content: v })} placeholder="Escreva o conteúdo do post..." />
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Switch checked={form.published} onCheckedChange={(v) => update({ published: v })} />
          <div>
            <Label className="cursor-pointer">Publicado</Label>
            <p className="text-xs text-muted-foreground">Quando ativo, fica visível em /blog</p>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/blog')}>Cancelar</Button>
        </div>
      </Card>
    </div>
  );
}
