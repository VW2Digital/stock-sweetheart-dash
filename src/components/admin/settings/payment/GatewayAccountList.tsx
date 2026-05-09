import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, Star, Plus, Power, Loader2, PlugZap, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  GatewayAccount,
  GatewayKey,
  listGatewayAccounts,
  deleteGatewayAccount,
  setPrimaryAccount,
  updateGatewayAccount,
} from '@/lib/gatewayAccounts';
import AddGatewayAccountDialog from './AddGatewayAccountDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Props { gateway: GatewayKey }

const GatewayAccountList = ({ gateway }: Props) => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<GatewayAccount | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  const load = async () => {
    setLoading(true);
    try {
      setAccounts(await listGatewayAccounts(gateway));
    } catch (err: any) {
      toast({ title: 'Erro ao carregar contas', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [gateway]);

  const handleDelete = async (id: string) => {
    try {
      await deleteGatewayAccount(id);
      toast({ title: 'Conta removida' });
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handlePrimary = async (acc: GatewayAccount) => {
    try {
      await setPrimaryAccount(acc.id, gateway);
      toast({ title: `${acc.label} agora é a principal` });
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (acc: GatewayAccount) => {
    try {
      await updateGatewayAccount(acc.id, { active: !acc.active });
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleTest = async (acc: GatewayAccount) => {
    setTestingId(acc.id);
    try {
      const { data, error } = await supabase.functions.invoke('gateway-test-account', {
        body: { account_id: acc.id },
      });
      if (error) throw error;
      const ok = Boolean(data?.ok);
      setTestResults((p) => ({ ...p, [acc.id]: { ok, message: data?.message || (ok ? 'OK' : 'Falhou') } }));
      toast({
        title: ok ? 'Credenciais válidas' : 'Falha no teste',
        description: data?.message,
        variant: ok ? 'default' : 'destructive',
      });
    } catch (err: any) {
      setTestResults((p) => ({ ...p, [acc.id]: { ok: false, message: err.message } }));
      toast({ title: 'Erro ao testar', description: err.message, variant: 'destructive' });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Contas cadastradas</h3>
          <p className="text-xs text-muted-foreground">
            {accounts.filter((a) => a.active).length} ativa(s) — distribuição em round-robin
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setAddOpen(true); }} className="gap-1">
          <Plus className="w-4 h-4" /> Adicionar conta
        </Button>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando…</div>
      ) : accounts.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
          Nenhuma conta cadastrada ainda. Clique em "Adicionar conta" para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{acc.label}</span>
                  {acc.is_primary && <Badge variant="default" className="gap-1 h-5 text-[10px]"><Star className="w-3 h-3" /> Principal</Badge>}
                  <Badge variant={acc.environment === 'production' ? 'default' : 'secondary'} className="h-5 text-[10px]">
                    {acc.environment === 'production' ? 'Produção' : 'Sandbox'}
                  </Badge>
                  {!acc.active && <Badge variant="outline" className="h-5 text-[10px]">Inativa</Badge>}
                </div>
                {acc.last_used_at && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Último uso: {new Date(acc.last_used_at).toLocaleString('pt-BR')}
                  </p>
                )}
                {testResults[acc.id] && (
                  <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${testResults[acc.id].ok ? 'text-emerald-600' : 'text-destructive'}`}>
                    {testResults[acc.id].ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {testResults[acc.id].message}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Testar credenciais"
                  onClick={() => handleTest(acc)}
                  disabled={testingId === acc.id}
                >
                  {testingId === acc.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <PlugZap className="w-4 h-4" />}
                </Button>
                {!acc.is_primary && (
                  <Button variant="ghost" size="icon" title="Tornar principal" onClick={() => handlePrimary(acc)}>
                    <Star className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" title={acc.active ? 'Desativar' : 'Ativar'} onClick={() => handleToggleActive(acc)}>
                  <Power className={`w-4 h-4 ${acc.active ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                </Button>
                <Button variant="ghost" size="icon" title="Editar" onClick={() => { setEditing(acc); setAddOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Excluir">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover conta "{acc.label}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação é permanente. As credenciais serão apagadas. Pedidos antigos não serão afetados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(acc.id)}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddGatewayAccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        gateway={gateway}
        account={editing}
        onSaved={load}
      />
    </div>
  );
};

export default GatewayAccountList;