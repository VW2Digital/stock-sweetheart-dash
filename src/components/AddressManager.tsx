import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MapPin, Plus, Trash2, Star, Loader2, X, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cleanCep, formatCep as formatCepUtil, isValidCep } from '@/lib/cep';

export interface Address {
  id: string;
  user_id: string;
  label: string;
  postal_code: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  is_default: boolean;
}

const AddressManager = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fetchingCep, setFetchingCep] = useState(false);

  // Form fields
  const [label, setLabel] = useState(t('homeAddressLabel'));
  const [postalCode, setPostalCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', session.user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAddresses((data as any[]) || []);
    } catch (err: any) {
      toast({ title: t('addressesLoadError'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAddresses(); }, []);

  const resetForm = () => {
    setLabel(t('homeAddressLabel'));
    setPostalCode('');
    setStreet('');
    setNumber('');
    setComplement('');
    setDistrict('');
    setCity('');
    setState('');
    setIsDefault(false);
    setEditingId(null);
    setShowForm(false);
  };

  const formatCep = formatCepUtil;

  const getCepError = (value: string) => {
    const digits = cleanCep(value);
    if (digits.length === 0) return t('cepRequired');
    if (digits.length !== 8) return t('cepMustHave8Digits');
    if (/^(\d)\1{7}$/.test(digits) || digits.startsWith('0000')) return t('cepInvalid');
    return null;
  };

  const fetchAddressByCep = async (cep: string) => {
    const digits = cleanCep(cep);
    if (!isValidCep(digits)) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStreet(data.logradouro || '');
        setDistrict(data.bairro || '');
        setCity(data.localidade || '');
        setState(data.uf || '');
      }
    } catch { /* ignore */ }
    finally { setFetchingCep(false); }
  };

  const handleSave = async () => {
    const cepError = getCepError(postalCode);
    if (cepError) {
      toast({ title: cepError, variant: 'destructive' }); return;
    }
    if (!street.trim() || !number.trim() || !district.trim() || !city.trim() || !state.trim()) {
      toast({ title: t('fillRequiredFields'), variant: 'destructive' }); return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t('notAuthenticated'));

      const payload = {
        user_id: session.user.id,
        label: label.trim() || t('homeAddressLabel'),
        postal_code: cleanCep(postalCode),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        district: district.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        is_default: isDefault || addresses.length === 0,
      };

      if (editingId) {
        const { error } = await supabase
          .from('addresses')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast({ title: t('addressUpdated') });
      } else {
        const { error } = await supabase
          .from('addresses')
          .insert(payload);
        if (error) throw error;
        toast({ title: t('addressSaved') });
      }

      resetForm();
      await fetchAddresses();
    } catch (err: any) {
      toast({ title: t('saveError'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (addr: Address) => {
    setEditingId(addr.id);
    setLabel(addr.label);
    setPostalCode(formatCep(addr.postal_code));
    setStreet(addr.street);
    setNumber(addr.number);
    setComplement(addr.complement || '');
    setDistrict(addr.district);
    setCity(addr.city);
    setState(addr.state);
    setIsDefault(addr.is_default);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('addresses').delete().eq('id', id);
      if (error) throw error;
      toast({ title: t('addressRemoved') });
      await fetchAddresses();
    } catch (err: any) {
      toast({ title: t('removeError'), description: err.message, variant: 'destructive' });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
      toast({ title: t('defaultAddressUpdated') });
      await fetchAddresses();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <MapPin className="w-5 h-5" /> {t('myAddresses')}
        </h3>
        {!showForm && (
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {t('newAddressTitle')}
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {editingId ? t('editAddressTitle') : t('newAddressTitle')}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('addressName')}</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('addressNamePlaceholder')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('cep')} *</Label>
                <div className="relative">
                  <Input
                    value={postalCode}
                    onChange={(e) => {
                      const formatted = formatCep(e.target.value);
                      setPostalCode(formatted);
                      if (formatted.replace(/\D/g, '').length === 8) fetchAddressByCep(formatted);
                    }}
                    placeholder="00000-000"
                  />
                  {fetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">{t('streetAddress')} *</Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('addressNumber')} *</Label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('complement')}</Label>
                <Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder={t('complementPlaceholder')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('district')} *</Label>
                <Input value={district} onChange={(e) => setDistrict(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('city')} *</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">UF *</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="is-default" className="text-sm text-muted-foreground cursor-pointer">
                {t('useAsDefaultAddress')}
              </Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editingId ? t('update') : t('save')}
              </Button>
              <Button variant="outline" onClick={resetForm}>{t('cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : addresses.length === 0 && !showForm ? (
        <Card className="border-border/50">
          <CardContent className="py-10 text-center space-y-3">
            <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">{t('noAddresses')}</p>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> {t('addAddress')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {addresses.map((addr) => (
            <Card key={addr.id} className={`border-border/50 ${addr.is_default ? 'ring-2 ring-primary/30' : ''}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">{addr.label}</span>
                    {addr.is_default && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        <Star className="w-2.5 h-2.5 mr-0.5" /> {t('default')}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>{addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ''}</p>
                  <p>{addr.district} - {addr.city}/{addr.state}</p>
                  <p>{t('cep')}: {addr.postal_code.replace(/(\d{5})(\d{3})/, '$1-$2')}</p>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleEdit(addr)}>
                    {t('edit')}
                  </Button>
                  {!addr.is_default && (
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleSetDefault(addr.id)}>
                      <Star className="w-3 h-3 mr-1" /> {t('makeDefault')}
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('removeAddressQuestion')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('addressWillBeRemoved', { label: addr.label })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(addr.id)}>{t('remove')}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressManager;
