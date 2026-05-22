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
import { Zap, ArrowLeft, Save, Plus, Trash2, GripVertical, Download, Link2, ExternalLink, Mail, Phone, Gift, Star, Heart, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import { FaWhatsapp, FaTelegram, FaInstagram, FaFacebook, FaYoutube, FaTiktok } from 'react-icons/fa';
import { FlashCampaignBlocksEditor, type CampaignBlock } from '@/components/admin/FlashCampaignBlocksEditor';
import { FlashCampaignPreview } from '@/components/admin/FlashCampaignPreview';

interface PaymentLinkOpt { id: string; title: string; slug: string; }
interface ProductOpt {
  id: string;
  name: string;
  variations: { id: string; dosage: string; price: number; offer_price: number | null; is_offer: boolean }[];
}

type Source = 'existing' | 'product';
type DiscountMode = 'fixed' | 'percent';
type CampaignMode = 'sale' | 'lead';

interface ThankYouButton {
  label: string;
  url: string;
  color?: string;
  icon?: string;
  new_tab?: boolean;
}

const ICON_OPTIONS = [
  { value: '', label: 'Nenhum', Icon: null as any },
  { value: 'whatsapp', label: 'WhatsApp', Icon: FaWhatsapp },
  { value: 'telegram', label: 'Telegram', Icon: FaTelegram },
  { value: 'instagram', label: 'Instagram', Icon: FaInstagram },
  { value: 'facebook', label: 'Facebook', Icon: FaFacebook },
  { value: 'youtube', label: 'YouTube', Icon: FaYoutube },
  { value: 'tiktok', label: 'TikTok', Icon: FaTiktok },
  { value: 'message', label: 'Mensagem', Icon: MessageSquare },
  { value: 'download', label: 'Download', Icon: Download },
  { value: 'link', label: 'Link', Icon: Link2 },
  { value: 'external', label: 'Link externo', Icon: ExternalLink },
  { value: 'mail', label: 'Email', Icon: Mail },
  { value: 'phone', label: 'Telefone', Icon: Phone },
  { value: 'gift', label: 'Presente', Icon: Gift },
  { value: 'star', label: 'Estrela', Icon: Star },
  { value: 'heart', label: 'Coração', Icon: Heart },
  { value: 'send', label: 'Enviar', Icon: Send },
  { value: 'check', label: 'Confirmação', Icon: CheckCircle2 },
];

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
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [headline, setHeadline] = useState('OFERTA RELÂMPAGO');
  const [subheadline, setSubheadline] = useState('Por tempo limitadíssimo. Garanta antes que acabe.');
  const [ctaText, setCtaText] = useState('GARANTIR AGORA');
  const [paymentLinkId, setPaymentLinkId] = useState('');
  // Product-based source
  const [source, setSource] = useState<Source>('product');
  const [productId, setProductId] = useState('');
  const [variationId, setVariationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('percent');
  const [discountValue, setDiscountValue] = useState('20');
  const [promoPrice, setPromoPrice] = useState('');
  const [autoLinkId, setAutoLinkId] = useState<string | null>(null);
  const [maxInstallments, setMaxInstallments] = useState('6');
  const [pixDiscount, setPixDiscount] = useState('0');
  const [expiresAt, setExpiresAt] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [bgColor, setBgColor] = useState('#0d0d0d');
  const [accentColor, setAccentColor] = useState('#c9a84c');
  const [active, setActive] = useState(true);

  // Mode + lead capture
  const [mode, setMode] = useState<CampaignMode>('sale');
  const [captureLead, setCaptureLead] = useState(false);
  const [leadFormTitle, setLeadFormTitle] = useState('Garanta sua vaga');
  const [leadFormSubtitle, setLeadFormSubtitle] = useState('Preencha seus dados para continuar');
  const [leadCtaText, setLeadCtaText] = useState('QUERO ME INSCREVER');

  // Thank you page
  const [thankYouHeadline, setThankYouHeadline] = useState('Obrigado!');
  const [thankYouMessage, setThankYouMessage] = useState('Em instantes você receberá mais informações pelo email e WhatsApp.');
  const [thankYouBgColor, setThankYouBgColor] = useState('#0a0000');
  const [thankYouAccentColor, setThankYouAccentColor] = useState('#22c55e');
  const [thankYouButtons, setThankYouButtons] = useState<ThankYouButton[]>([]);

  // Page builder
  const [blocks, setBlocks] = useState<CampaignBlock[]>([]);
  const [floatingCtaEnabled, setFloatingCtaEnabled] = useState(false);
  const [floatingCtaText, setFloatingCtaText] = useState('');

  useEffect(() => {
    (async () => {
      const { data: pls } = await supabase
        .from('payment_links').select('id,title,slug').eq('active', true)
        .order('created_at', { ascending: false });
      setLinks((pls as any) || []);

      const { data: prods } = await supabase
        .from('products')
        .select('id,name,product_variations(id,dosage,price,offer_price,is_offer)')
        .eq('active', true)
        .order('name');
      setProducts(((prods as any[]) || []).map(p => ({
        id: p.id, name: p.name,
        variations: (p.product_variations || []).map((v: any) => ({
          id: v.id, dosage: v.dosage, price: Number(v.price) || 0,
          offer_price: v.offer_price != null ? Number(v.offer_price) : null,
          is_offer: !!v.is_offer,
        })),
      })));

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
        setSource((camp.source as Source) || 'existing');
        if (camp.product_id) setProductId(camp.product_id);
        if (camp.variation_id) setVariationId(camp.variation_id);
        if (camp.quantity != null) setQuantity(String(camp.quantity));
        if (camp.discount_mode) setDiscountMode(camp.discount_mode as DiscountMode);
        if (camp.discount_value != null) setDiscountValue(String(camp.discount_value));
        if (camp.promo_price != null) setPromoPrice(String(camp.promo_price));
        if (camp.max_installments != null) setMaxInstallments(String(camp.max_installments));
        if (camp.pix_discount != null) setPixDiscount(String(camp.pix_discount));
        if (camp.auto_link_id) setAutoLinkId(camp.auto_link_id);
        setExpiresAt(camp.expires_at?.slice(0, 16) || '');
        setStartsAt(camp.starts_at?.slice(0, 16) || '');
        setBgImage(camp.background_image || '');
        setBgColor(camp.bg_color || '#0a0000');
        setAccentColor(camp.accent_color || '#ef4444');
        setActive(camp.active);
        if (camp.mode) setMode(camp.mode as CampaignMode);
        setCaptureLead(!!camp.capture_lead);
        if (camp.lead_form_title) setLeadFormTitle(camp.lead_form_title);
        if (camp.lead_form_subtitle) setLeadFormSubtitle(camp.lead_form_subtitle);
        if (camp.lead_cta_text) setLeadCtaText(camp.lead_cta_text);
        if (camp.thank_you_headline) setThankYouHeadline(camp.thank_you_headline);
        if (camp.thank_you_message) setThankYouMessage(camp.thank_you_message);
        if (camp.thank_you_bg_color) setThankYouBgColor(camp.thank_you_bg_color);
        if (camp.thank_you_accent_color) setThankYouAccentColor(camp.thank_you_accent_color);
        if (Array.isArray(camp.thank_you_buttons)) setThankYouButtons(camp.thank_you_buttons);
        if (Array.isArray(camp.blocks)) setBlocks(camp.blocks);
        setFloatingCtaEnabled(!!camp.floating_cta_enabled);
        if (camp.floating_cta_text) setFloatingCtaText(camp.floating_cta_text);
        setLoading(false);
      }
    })();
  }, [id, isEdit, navigate, toast]);

  const selectedProduct = products.find(p => p.id === productId);
  const selectedVariation = selectedProduct?.variations.find(v => v.id === variationId);
  const basePrice = selectedVariation?.price || 0;

  const computedPromoPrice = (() => {
    if (discountMode === 'fixed') return Number(promoPrice) || 0;
    const pct = Math.min(Math.max(Number(discountValue) || 0, 0), 99);
    return Number((basePrice * (1 - pct / 100)).toFixed(2));
  })();
  const finalUnit = computedPromoPrice > 0 ? computedPromoPrice : basePrice;
  const totalAmount = Number((finalUnit * (Number(quantity) || 1)).toFixed(2));
  const discountPct = basePrice > 0 ? Math.round((1 - finalUnit / basePrice) * 100) : 0;

  const save = async () => {
    if (!title.trim() || !expiresAt) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha título e validade.', variant: 'destructive' });
      return;
    }
    if (mode === 'sale' && source === 'existing' && !paymentLinkId) {
      toast({ title: 'Selecione um link de pagamento', variant: 'destructive' });
      return;
    }
    if (mode === 'sale' && source === 'product' && (!productId || !variationId || finalUnit <= 0)) {
      toast({ title: 'Selecione produto, variação e preço promocional válido', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const finalSlug = (slug.trim() || slugify(title)).toLowerCase();

    // Resolve payment_link_id (auto-create/update when source = product)
    let resolvedLinkId = paymentLinkId;
    if (mode === 'sale' && source === 'product') {
      const linkPayload = {
        title: `[Campanha] ${title.trim()}`,
        description: `${selectedProduct?.name} ${selectedVariation?.dosage} — ${quantity}x R$ ${finalUnit.toFixed(2)}`,
        amount: totalAmount,
        quantity: Number(quantity) || 1,
        unit_price: finalUnit,
        active: true,
        pix_discount_percent: Number(pixDiscount) || 0,
        max_installments: Number(maxInstallments) || 1,
      };
      if (autoLinkId) {
        const { error: upErr } = await supabase.from('payment_links').update(linkPayload).eq('id', autoLinkId);
        if (upErr) { setSaving(false); toast({ title: 'Erro ao atualizar link', description: upErr.message, variant: 'destructive' }); return; }
        resolvedLinkId = autoLinkId;
      } else {
        const linkSlug = `camp-${finalSlug}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: newLink, error: insErr } = await supabase
          .from('payment_links')
          .insert({ ...linkPayload, slug: linkSlug, user_id: user?.id })
          .select('id').single();
        if (insErr || !newLink) { setSaving(false); toast({ title: 'Erro ao criar link', description: insErr?.message, variant: 'destructive' }); return; }
        resolvedLinkId = newLink.id;
        setAutoLinkId(newLink.id);
      }
    }

    const payload: any = {
      title: title.trim(), slug: finalSlug, headline: headline.trim(), subheadline: subheadline.trim(),
      cta_text: ctaText.trim() || 'GARANTIR AGORA',
      payment_link_id: mode === 'lead' ? null : resolvedLinkId,
      expires_at: new Date(expiresAt).toISOString(), background_image: bgImage.trim() || null,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      bg_color: bgColor, accent_color: accentColor, active,
      source,
      product_id: mode === 'sale' && source === 'product' ? productId || null : null,
      variation_id: mode === 'sale' && source === 'product' ? variationId || null : null,
      quantity: Number(quantity) || 1,
      discount_mode: discountMode,
      discount_value: Number(discountValue) || 0,
      promo_price: discountMode === 'fixed' ? (Number(promoPrice) || null) : null,
      max_installments: Number(maxInstallments) || 1,
      pix_discount: Number(pixDiscount) || 0,
      auto_link_id: mode === 'sale' && source === 'product' ? (resolvedLinkId || null) : null,
      mode,
      capture_lead: mode === 'lead' ? true : captureLead,
      lead_form_title: leadFormTitle.trim() || null,
      lead_form_subtitle: leadFormSubtitle.trim() || null,
      lead_cta_text: leadCtaText.trim() || null,
      thank_you_headline: thankYouHeadline.trim() || null,
      thank_you_message: thankYouMessage.trim() || null,
      thank_you_bg_color: thankYouBgColor,
      thank_you_accent_color: thankYouAccentColor,
      thank_you_buttons: thankYouButtons,
      blocks,
      floating_cta_enabled: floatingCtaEnabled,
      floating_cta_text: floatingCtaText.trim() || null,
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

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6 min-w-0">


      <AdminSection title="Informações básicas">
        <div className="grid gap-4">
          <div>
            <Label>Tipo de campanha *</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as CampaignMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">Venda (com checkout)</SelectItem>
                <SelectItem value="lead">Somente captura de lead (sem pagamento)</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          {mode === 'sale' && (
            <>
          <div>
            <Label>Origem do checkout *</Label>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Produto + preço promocional (criar link automaticamente)</SelectItem>
                <SelectItem value="existing">Usar link de pagamento existente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {source === 'existing' && (
            <div>
              <Label>Link de pagamento *</Label>
              <Select value={paymentLinkId} onValueChange={setPaymentLinkId}>
                <SelectTrigger><SelectValue placeholder="Selecione um link de pagamento" /></SelectTrigger>
                <SelectContent>
                  {links.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {links.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Crie um link em "Links de Pagamento" antes.</p>
              )}
            </div>
          )}

          {source === 'product' && (
            <div className="grid gap-4 rounded-md border border-border/60 bg-muted/30 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Produto *</Label>
                  <Select value={productId} onValueChange={(v) => { setProductId(v); setVariationId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Variação *</Label>
                  <Select value={variationId} onValueChange={setVariationId} disabled={!selectedProduct}>
                    <SelectTrigger><SelectValue placeholder={selectedProduct ? 'Selecione' : 'Escolha o produto'} /></SelectTrigger>
                    <SelectContent>
                      {selectedProduct?.variations.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.dosage} — R$ {v.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </div>
                <div>
                  <Label>Tipo de desconto</Label>
                  <Select value={discountMode} onValueChange={(v) => setDiscountMode(v as DiscountMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">% de desconto</SelectItem>
                      <SelectItem value="fixed">Preço final em R$</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  {discountMode === 'percent' ? (
                    <>
                      <Label>Desconto (%)</Label>
                      <Input type="number" min="0" max="99" step="1" value={discountValue} onChange={e => setDiscountValue(e.target.value)} />
                    </>
                  ) : (
                    <>
                      <Label>Preço promocional (R$)</Label>
                      <Input type="number" min="0.01" step="0.01" value={promoPrice} onChange={e => setPromoPrice(e.target.value)} placeholder={basePrice ? basePrice.toFixed(2) : '0,00'} />
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Máx. parcelas (cartão)</Label>
                  <Input type="number" min="1" max="12" step="1" value={maxInstallments} onChange={e => setMaxInstallments(e.target.value)} />
                </div>
                <div>
                  <Label>Desconto extra PIX (%)</Label>
                  <Input type="number" min="0" max="100" step="1" value={pixDiscount} onChange={e => setPixDiscount(e.target.value)} />
                </div>
              </div>

              {basePrice > 0 && (
                <div className="rounded-md bg-background border border-border p-3 grid gap-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Preço original</span><span className="line-through">R$ {basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Preço promocional unitário</span><span className="font-semibold text-primary">R$ {finalUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span>{discountPct}%</span></div>
                  <div className="flex justify-between border-t border-border pt-2 mt-1"><span className="font-medium">Total ({quantity}x)</span><span className="text-lg font-bold text-primary">R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                </div>
              )}
            </div>
          )}
            </>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Início agendado (opcional)</Label>
              <Input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Antes desta data a página fica indisponível.</p>
            </div>
            <div>
              <Label>Validade *</Label>
              <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Após esta data a campanha expira automaticamente.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Campanha ativa (master switch)</Label>
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

      <AdminSection
        title="Construtor de página"
        description="Adicione blocos (vídeo, benefícios, bônus, depoimentos, FAQ...) e arraste para reordenar. Eles aparecem entre a headline e o final da página."
      >
        <FlashCampaignBlocksEditor blocks={blocks} onChange={setBlocks} />
      </AdminSection>

      <AdminSection title="CTA flutuante" description="Barra fixa no rodapé que acompanha o usuário durante a rolagem.">
        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={floatingCtaEnabled} onCheckedChange={setFloatingCtaEnabled} />
            <Label>Mostrar barra de CTA fixa no rodapé</Label>
          </div>
          {floatingCtaEnabled && (
            <div>
              <Label>Texto do botão (opcional — usa o CTA principal se vazio)</Label>
              <Input value={floatingCtaText} onChange={e => setFloatingCtaText(e.target.value)} placeholder="QUERO GARANTIR" />
            </div>
          )}
        </div>
      </AdminSection>

      <AdminSection title="Captura de lead">
        <div className="grid gap-4">
          {mode === 'sale' && (
            <div className="flex items-center gap-2">
              <Switch checked={captureLead} onCheckedChange={setCaptureLead} />
              <Label>Coletar nome, email e WhatsApp antes de levar ao checkout</Label>
            </div>
          )}
          {mode === 'lead' && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
              Em campanhas "somente lead", o formulário sempre é exibido e não há pagamento.
            </div>
          )}
          {(mode === 'lead' || captureLead) && (
            <>
              <div>
                <Label>Título do formulário</Label>
                <Input value={leadFormTitle} onChange={e => setLeadFormTitle(e.target.value)} />
              </div>
              <div>
                <Label>Subtítulo do formulário</Label>
                <Input value={leadFormSubtitle} onChange={e => setLeadFormSubtitle(e.target.value)} />
              </div>
              <div>
                <Label>Texto do botão de envio</Label>
                <Input value={leadCtaText} onChange={e => setLeadCtaText(e.target.value)} />
              </div>
            </>
          )}
        </div>
      </AdminSection>

      <AdminSection
        title="Página de obrigado"
        description="Exibida após captura do lead (modo lead) ou após pagamento confirmado (modo venda). URL: /relampago/[slug]/obrigado"
      >
        <div className="grid gap-4">
          <div>
            <Label>Headline</Label>
            <Input value={thankYouHeadline} onChange={e => setThankYouHeadline(e.target.value)} />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea rows={3} value={thankYouMessage} onChange={e => setThankYouMessage(e.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Cor de fundo</Label>
              <Input type="color" value={thankYouBgColor} onChange={e => setThankYouBgColor(e.target.value)} />
            </div>
            <div>
              <Label>Cor de destaque</Label>
              <Input type="color" value={thankYouAccentColor} onChange={e => setThankYouAccentColor(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Botões da página</Label>
              <Button type="button" size="sm" variant="outline"
                      onClick={() => setThankYouButtons([...thankYouButtons, { label: '', url: '', color: thankYouAccentColor, icon: '', new_tab: true }])}>
                <Plus className="w-3.5 h-3.5 mr-1" />Adicionar botão
              </Button>
            </div>
            {thankYouButtons.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum botão configurado.</p>
            )}
            {thankYouButtons.map((b, i) => (
              <div key={i} className="rounded-md border border-border bg-muted/30 p-3 grid gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <GripVertical className="w-4 h-4 text-muted-foreground" /> Botão {i + 1}
                  </div>
                  <Button type="button" size="sm" variant="ghost"
                          onClick={() => setThankYouButtons(thankYouButtons.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Texto</Label>
                    <Input value={b.label} onChange={e => {
                      const next = [...thankYouButtons]; next[i] = { ...b, label: e.target.value }; setThankYouButtons(next);
                    }} placeholder="Ex: Entrar no grupo VIP" />
                  </div>
                  <div>
                    <Label>URL</Label>
                    <Input value={b.url} onChange={e => {
                      const next = [...thankYouButtons]; next[i] = { ...b, url: e.target.value }; setThankYouButtons(next);
                    }} placeholder="https://..." />
                  </div>
                  <div>
                    <Label>Ícone</Label>
                    <Select value={b.icon || 'none'} onValueChange={(v) => {
                      const next = [...thankYouButtons]; next[i] = { ...b, icon: v === 'none' ? '' : v }; setThankYouButtons(next);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map(o => (
                          <SelectItem key={o.value || 'none'} value={o.value || 'none'}>
                            <span className="inline-flex items-center gap-2">
                              {o.Icon ? <o.Icon className="w-4 h-4" /> : null}
                              {o.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cor de fundo</Label>
                    <Input type="color" value={b.color || thankYouAccentColor} onChange={e => {
                      const next = [...thankYouButtons]; next[i] = { ...b, color: e.target.value }; setThankYouButtons(next);
                    }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!b.new_tab} onCheckedChange={(v) => {
                    const next = [...thankYouButtons]; next[i] = { ...b, new_tab: v }; setThankYouButtons(next);
                  }} />
                  <Label>Abrir em nova aba</Label>
                </div>
              </div>
            ))}
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

        <div className="min-w-0">
          <div className="xl:sticky xl:top-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pré-visualização ao vivo</Label>
              <span className="text-[10px] text-muted-foreground">Atualiza automaticamente</span>
            </div>
            <div className="rounded-xl border border-border overflow-hidden bg-black shadow-lg">
              <div className="h-[calc(100vh-10rem)] overflow-y-auto">
                <FlashCampaignPreview
                  title={title}
                  headline={headline}
                  subheadline={subheadline}
                  ctaText={ctaText}
                  bgColor={bgColor}
                  accentColor={accentColor}
                  bgImage={bgImage}
                  expiresAt={expiresAt}
                  startsAt={startsAt}
                  mode={mode}
                  totalAmount={mode === 'sale' ? totalAmount : 0}
                  blocks={blocks}
                  floatingCtaEnabled={floatingCtaEnabled}
                  floatingCtaText={floatingCtaText}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
