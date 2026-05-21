import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Languages, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { fetchSettingsBulk, upsertSetting } from '@/lib/api';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { languages as LANG_INFO } from '@/contexts/LanguageContext';
import { invalidateLanguageSettingsCache } from '@/hooks/useLanguageSettings';

const ALL: SupportedLanguage[] = [...SUPPORTED_LANGUAGES];

const SettingsLanguages = () => {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<SupportedLanguage[]>(ALL);
  const [defaultLang, setDefaultLang] = useState<SupportedLanguage>('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettingsBulk(['enabled_languages', 'default_language'])
      .then((map) => {
        try {
          const parsed = JSON.parse(map.enabled_languages || '[]');
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEnabled(parsed.filter((v: string) => (ALL as string[]).includes(v)) as SupportedLanguage[]);
          }
        } catch {
          // mantém ALL
        }
        const d = (map.default_language || 'en') as SupportedLanguage;
        if ((ALL as string[]).includes(d)) setDefaultLang(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (code: SupportedLanguage, checked: boolean) => {
    setEnabled((prev) => {
      const next = checked ? Array.from(new Set([...prev, code])) : prev.filter((c) => c !== code);
      // Garante pelo menos um habilitado
      if (next.length === 0) return prev;
      // Se desabilitou o padrão, troca para o primeiro habilitado
      if (!next.includes(defaultLang)) setDefaultLang(next[0]);
      return next;
    });
  };

  const handleSave = async () => {
    if (enabled.length === 0) {
      toast.error('Habilite ao menos um idioma');
      return;
    }
    if (!enabled.includes(defaultLang)) {
      toast.error('O idioma padrão precisa estar habilitado');
      return;
    }
    setSaving(true);
    try {
      await upsertSetting('enabled_languages', JSON.stringify(enabled));
      await upsertSetting('default_language', defaultLang);
      invalidateLanguageSettingsCache();
      toast.success('Configurações de idioma salvas');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/configuracoes')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Languages className="w-5 h-5" /> Idiomas
          </h1>
          <p className="text-sm text-muted-foreground">
            Habilite os idiomas disponíveis na loja e escolha o idioma padrão.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Idiomas disponíveis</CardTitle>
          <CardDescription>Apenas os idiomas marcados aparecerão no seletor da loja.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : (
            LANG_INFO.map((info) => {
              const isEnabled = enabled.includes(info.code);
              return (
                <div
                  key={info.code}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/60 bg-card"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://flagcdn.com/w40/${info.flag}.png`}
                      alt={info.label}
                      className="w-7 h-5 object-cover rounded-sm"
                    />
                    <div>
                      <p className="text-sm font-medium">{info.label}</p>
                      <p className="text-xs text-muted-foreground uppercase">{info.code}</p>
                    </div>
                  </div>
                  <Checkbox
                    checked={isEnabled}
                    onCheckedChange={(c) => toggle(info.code, Boolean(c))}
                    aria-label={`Habilitar ${info.label}`}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Idioma padrão</CardTitle>
          <CardDescription>
            Usado para novos visitantes que ainda não escolheram um idioma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <RadioGroup
              value={defaultLang}
              onValueChange={(v) => setDefaultLang(v as SupportedLanguage)}
              className="space-y-2"
            >
              {LANG_INFO.filter((l) => enabled.includes(l.code)).map((info) => (
                <div
                  key={info.code}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60"
                >
                  <RadioGroupItem value={info.code} id={`def-${info.code}`} />
                  <Label htmlFor={`def-${info.code}`} className="flex items-center gap-2 cursor-pointer flex-1">
                    <img
                      src={`https://flagcdn.com/w40/${info.flag}.png`}
                      alt={info.label}
                      className="w-6 h-4 object-cover rounded-sm"
                    />
                    {info.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
      </div>
    </div>
  );
};

export default SettingsLanguages;
