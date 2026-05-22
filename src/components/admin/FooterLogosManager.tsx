import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Upload, Loader2, Image as ImageIcon, ArrowUp, ArrowDown } from 'lucide-react';

export type FooterLogoCategory = 'payment' | 'security' | 'shipping';

export interface FooterLogo {
  id: string;
  category: FooterLogoCategory;
  label: string;
  image_url: string;
  link_url: string | null;
  active: boolean;
  sort_order: number;
}

const CATEGORIES: { key: FooterLogoCategory; title: string; help: string }[] = [
  { key: 'payment', title: 'Métodos de Pagamento', help: 'Logos como Visa, Mastercard, Pix...' },
  { key: 'security', title: 'Selos de Segurança', help: 'Site Seguro, Google Safe Browsing...' },
  { key: 'shipping', title: 'Transportadoras', help: 'SEDEX, PAC, Jadlog, J&T Express...' },
];

const FooterLogosManager = () => {
  const { toast } = useToast();
  const [logos, setLogos] = useState<FooterLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<FooterLogoCategory | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('footer_logos')
      .select('*')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) {
      toast({ title: 'Erro ao carregar logos', description: error.message, variant: 'destructive' });
    } else {
      setLogos((data || []) as FooterLogo[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (category: FooterLogoCategory, file: File) => {
    setUploadingFor(category);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${category}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('footer-logos').upload(path, file, {
        contentType: file.type || 'image/png',
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('footer-logos').getPublicUrl(path);
      const maxOrder = Math.max(0, ...logos.filter((l) => l.category === category).map((l) => l.sort_order));
      const { error: insErr } = await supabase.from('footer_logos').insert({
        category,
        label: file.name.replace(/\.[^.]+$/, ''),
        image_url: pub.publicUrl,
        active: true,
        sort_order: maxOrder + 1,
      });
      if (insErr) throw insErr;
      toast({ title: 'Logo adicionado' });
      load();
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingFor(null);
    }
  };

  const updateLogo = async (id: string, patch: Partial<FooterLogo>) => {
    setLogos((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from('footer_logos').update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      load();
    }
  };

  const deleteLogo = async (logo: FooterLogo) => {
    if (!confirm(`Remover "${logo.label || 'logo'}"?`)) return;
    const { error } = await supabase.from('footer_logos').delete().eq('id', logo.id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      return;
    }
    // Try to remove file from storage if it belongs to our bucket
    try {
      const marker = '/footer-logos/';
      const idx = logo.image_url.indexOf(marker);
      if (idx >= 0) {
        const path = logo.image_url.slice(idx + marker.length);
        await supabase.storage.from('footer-logos').remove([path]);
      }
    } catch {}
    toast({ title: 'Logo removido' });
    load();
  };

  const move = async (logo: FooterLogo, direction: -1 | 1) => {
    const group = logos.filter((l) => l.category === logo.category).sort((a, b) => a.sort_order - b.sort_order);
    const idx = group.findIndex((l) => l.id === logo.id);
    const target = group[idx + direction];
    if (!target) return;
    await Promise.all([
      supabase.from('footer_logos').update({ sort_order: target.sort_order }).eq('id', logo.id),
      supabase.from('footer_logos').update({ sort_order: logo.sort_order }).eq('id', target.id),
    ]);
    load();
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ImageIcon className="w-5 h-5" /> Logos do Rodapé
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Gerencie os logos exibidos nas colunas "Métodos de Pagamento", "Selos de Segurança" e "Transportadoras". Recomenda-se imagens PNG/SVG com fundo transparente, altura ~40-60px.
        </p>
      </CardHeader>
      <CardContent className="space-y-8">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          CATEGORIES.map(({ key, title, help }) => {
            const items = logos.filter((l) => l.category === key).sort((a, b) => a.sort_order - b.sort_order);
            const inputId = `footer-logo-upload-${key}`;
            return (
              <div key={key} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-foreground">{title}</h4>
                    <p className="text-xs text-muted-foreground">{help}</p>
                  </div>
                  <div>
                    <input
                      id={inputId}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(key, f);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingFor === key}
                      onClick={() => document.getElementById(inputId)?.click()}
                    >
                      {uploadingFor === key ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Adicionar logo
                    </Button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic border border-dashed border-border/50 rounded-md p-4 text-center">
                    Nenhum logo nesta categoria. Os logos padrão serão exibidos no rodapé.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((logo, i) => (
                      <div key={logo.id} className="flex items-center gap-3 border border-border/50 rounded-lg p-3 bg-card">
                        <div className="w-20 h-12 flex items-center justify-center bg-background rounded shrink-0 overflow-hidden">
                          <img src={logo.image_url} alt={logo.label} className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Rótulo / alt</Label>
                            <Input
                              value={logo.label}
                              onChange={(e) => setLogos((prev) => prev.map((l) => l.id === logo.id ? { ...l, label: e.target.value } : l))}
                              onBlur={(e) => updateLogo(logo.id, { label: e.target.value })}
                              placeholder="Ex.: Visa"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Link (opcional)</Label>
                            <Input
                              value={logo.link_url || ''}
                              onChange={(e) => setLogos((prev) => prev.map((l) => l.id === logo.id ? { ...l, link_url: e.target.value } : l))}
                              onBlur={(e) => updateLogo(logo.id, { link_url: e.target.value || null })}
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(logo, -1)}>
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === items.length - 1} onClick={() => move(logo, 1)}>
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Switch checked={logo.active} onCheckedChange={(v) => updateLogo(logo.id, { active: v })} />
                            <span className="text-xs text-muted-foreground">{logo.active ? 'Ativo' : 'Inativo'}</span>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => deleteLogo(logo)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default FooterLogosManager;
