import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { GATEWAY_FIELDS, GatewayKey, createGatewayAccount, updateGatewayAccount, GatewayAccount } from '@/lib/gatewayAccounts';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gateway: GatewayKey;
  account?: GatewayAccount | null;
  onSaved: () => void;
}

const GATEWAY_NAMES: Record<GatewayKey, string> = {
  asaas: 'Asaas',
  mercadopago: 'Mercado Pago',
  pagbank: 'PagBank',
  pagarme: 'Pagar.me',
};

const AddGatewayAccountDialog = ({ open, onOpenChange, gateway, account, onSaved }: Props) => {
  const { toast } = useToast();
  const fields = GATEWAY_FIELDS[gateway];
  const [label, setLabel] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production');
  const [isPrimary, setIsPrimary] = useState(false);
  const [active, setActive] = useState(true);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(account?.label ?? '');
      setEnvironment((account?.environment as 'sandbox' | 'production') ?? 'production');
      setIsPrimary(account?.is_primary ?? false);
      setActive(account?.active ?? true);
      setCredentials(account?.credentials ?? {});
    }
  }, [open, account]);

  const setField = (key: string, value: string) => setCredentials((c) => ({ ...c, [key]: value }));

  const handleSubmit = async () => {
    if (!label.trim()) {
      toast({ title: 'Informe um nome para a conta', variant: 'destructive' });
      return;
    }
    for (const f of fields) {
      if (f.required && !credentials[f.key]?.trim()) {
        toast({ title: `Campo obrigatório: ${f.label}`, variant: 'destructive' });
        return;
      }
    }
    setSaving(true);
    try {
      if (account) {
        await updateGatewayAccount(account.id, { label, environment, credentials, is_primary: isPrimary, active });
      } else {
        await createGatewayAccount({ gateway, label, environment, credentials, is_primary: isPrimary, active });
      }
      toast({ title: account ? 'Conta atualizada' : 'Conta adicionada' });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? 'Editar conta' : 'Adicionar conta'} — {GATEWAY_NAMES[gateway]}</DialogTitle>
          <DialogDescription>
            Cadastre as credenciais. Várias contas do mesmo gateway são distribuídas em round-robin nas transações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome da conta</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Conta principal, Conta 2" />
          </div>

          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={environment} onValueChange={(v) => setEnvironment(v as 'sandbox' | 'production')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                <SelectItem value="production">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {fields.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              <Input
                type={f.type === 'password' ? 'password' : 'text'}
                value={credentials[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
              {f.helpText && <p className="text-xs text-muted-foreground">{f.helpText}</p>}
            </div>
          ))}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Conta principal</Label>
              <p className="text-xs text-muted-foreground">Marca esta como a conta principal do {GATEWAY_NAMES[gateway]}.</p>
            </div>
            <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Ativa</Label>
              <p className="text-xs text-muted-foreground">Quando desativada, a conta fica de fora do round-robin.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {account ? 'Salvar alterações' : 'Adicionar conta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddGatewayAccountDialog;