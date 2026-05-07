import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminSection } from '@/components/admin/AdminSection';
import { Zap, ArrowLeft, Save } from 'lucide-react';

interface PaymentLinkOpt { id: string; title: string; slug: string; }

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  || Math.random().toString(36).slice(2, 10);

export default function FlashCampaignFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [links, setLinks] = useState<PaymentLinkOpt[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [headline, setHeadline] = useState('OFERTA RELÂMPAGO');
  const [subheadline, setSubheadline] = useState('Por tempo limitadíssimo. Garanta antes que acabe.');
  const [ctaText, setCtaText] = useState('GARANTIR AGORA');
  const [paymentLinkId, setPaymentLinkId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [bgColor, setBgColor] = useState('#0a0000');
  const [accentColor, setAccentColor] = useState('#ef4444');
  const [active, setActive] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: pls } = await supabase
        .from('payment_links').select('id,title,slug').eq('active', true)
        .order('created_at', { ascending: false });
      setLinks((pls as any) || []);

      if (isEdit) {
        const { data: c, error } = await supabase
          .from('flash_campaigns' as any).select('*').eq('id', id).maybeSingle();
        if (error || !c) {
          toast({ title: 'Campanha não encontrada', variant: 'destructive' });
          navigate('/admin/campanhas-relampago');
          return;
        }
        const camp = c as any;
        setTitle(camp.title); setSlug(camp.slug); setHeadline(camp.headline);
        setSubheadline(camp.subheadline); setCtaText(camp.cta_text);
        setPaymentLinkId(camp.payment_link_id);
        setExpiresAt(camp.expires_at?.slice(0, 16) || '');
        setBgImage(camp.background_image || '');
        setBgColor(camp.bg_color || '#0a0000');
        setAccentColor(camp.accent_color || '#ef4444');
        setActive(camp.active);
        setLoading(false);
      }
    })();
  }, [id, isEdit, navigate, toast]);

  const save = async () => {
    if (!title.trim() || !paymentLinkId || !expiresAt) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha título, link de pagamento e validade.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const finalSlug = (slug.trim() || slugify(title)).toLowerCase();
    const payload: any = {
      title: title.trim(), slug: finalSlug, headline: headline.trim(), subheadline: subheadline.trim(),
      cta_text: ctaText.trim() || 'GARANTIR AGORA', payment_link_id: paymentLinkId,
      expires_at: new Date(expiresAt).toISOString(), background_image: bgImage.trim() || null,
      bg_color: bgColor, accent_color: accentColor, active,
    };
    let error;
    if (isEdit) {
      ({ error } = await supabase.from('flash_campaigns' as any).update(payload).eq('id', id));
    } else {
      payload.user_id = user?.id;
      ({ error } = await supabase.from('flash_campaigns' as any).insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: isEdit ? 'Campanha atualizada' : 'Campanha criada' });
    navigate('/admin/campanhas-relampago');
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Zap}
        title={isEdit ? 'Editar campanha relâmpago' : 'Nova campanha relâmpago'}
        description="Configure a página de oferta com cronômetro de urgência"
        actions={
          <Button variant="outline" onClick={() => navigate('/admin/campanhas-relampago')}>
            <ArrowLeft className="w-4 h-4 mr-2" />Voltar
          </Button>
        }
      />

      <AdminSection title="Informações básicas">
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Título interno *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Black Friday" />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="auto" />
            </div>
          </div>
          <div>
            <Label>Link de pagamento *</Label>
            <Select value={paymentLinkId} onValueChange={setPaymentLinkId}>
              <SelectTrigger><SelectValue placeholder="Selecione um link de pagamento" /></SelectTrigger>
              <SelectContent>
                {links.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {links.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Crie um link em "Links de Pagamento" antes.
              </p>
            )}
          </div>
          <div>
            <Label>Validade *</Label>
            <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Campanha ativa</Label>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Conteúdo da página">
        <div className="grid gap-4">
          <div>
            <Label>Headline (chamada principal)</Label>
            <Input value={headline} onChange={e => setHeadline(e.target.value)} />
          </div>
          <div>
            <Label>Subheadline</Label>
            <Textarea value={subheadline} onChange={e => setSubheadline(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Texto do botão</Label>
            <Input value={ctaText} onChange={e => setCtaText(e.target.value)} />
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Visual">
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Cor de fundo</Label>
              <Input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} />
            </div>
            <div>
              <Label>Cor de destaque</Label>
              <Input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Imagem de fundo (URL opcional)</Label>
            <Input value={bgImage} onChange={e => setBgImage(e.target.value)} placeholder="https://..." />
          </div>
        </div>
      </AdminSection>

      <div className="flex justify-end gap-2 pb-4">
        <Button variant="outline" onClick={() => navigate('/admin/campanhas-relampago')}>Cancelar</Button>
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar campanha'}
        </Button>
      </div>
    </div>
  );
}