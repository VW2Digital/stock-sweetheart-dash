import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, ShieldCheck, User as UserIcon, KeyRound, Mail, Eye, EyeOff } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import iconUsuarioDetalhe from '@/assets/icon-usuario-detalhe-3d.png';
import { useToast } from '@/hooks/use-toast';
import AdminUserAddresses from '@/components/admin/AdminUserAddresses';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserDetail {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string;
  phone: string;
  roles: string[];
}

const InfoRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="flex justify-between gap-4 py-2 border-b border-border/40 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground text-right break-all">{value || '-'}</span>
  </div>
);

const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await supabase.functions.invoke('admin-users', { method: 'GET' });
        if (res.error) throw new Error(res.error.message);
        const list: UserDetail[] = res.data || [];
        const found = list.find((u) => u.id === id) || null;
        setUser(found);
        if (!found) {
          toast({ title: 'Usuário não encontrado', variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Erro ao carregar usuário', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/usuarios')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <p className="text-muted-foreground text-center py-12">Usuário não encontrado.</p>
      </div>
    );
  }

  const handleSetPassword = async () => {
    if (!user) return;
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await supabase.functions.invoke('admin-users', {
        method: 'POST',
        body: { action: 'set_password', userId: user.id, newPassword },
      });
      if (res.error) throw new Error(res.error.message);
      if ((res.data as any)?.error) throw new Error((res.data as any).error);
      toast({ title: 'Senha atualizada', description: 'A nova senha já está ativa para o usuário.' });
      setNewPassword('');
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar senha', description: err.message, variant: 'destructive' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendReset = async () => {
    if (!user) return;
    setSendingReset(true);
    try {
      const res = await supabase.functions.invoke('admin-users', {
        method: 'POST',
        body: { action: 'send_reset_email', userId: user.id, redirectTo: `${window.location.origin}/redefinir-senha` },
      });
      if (res.error) throw new Error(res.error.message);
      if ((res.data as any)?.error) throw new Error((res.data as any).error);
      toast({ title: 'Email enviado', description: `Link de redefinição enviado para ${user.email}.` });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar email', description: err.message, variant: 'destructive' });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <AdminPageHeader
        title={(user.full_name || '').trim() || (user.email || '').trim() || 'Usuário sem nome'}
        description={(user.email || '').trim() || 'E-mail não cadastrado'}
        iconImage={iconUsuarioDetalhe}
        breadcrumbs={[
          { label: 'Usuários', to: '/admin/usuarios' },
          { label: (user.full_name || '').trim() || (user.email || '').trim() || 'Detalhe' },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/usuarios')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar para Usuários
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Nome" value={user.full_name || 'Sem nome'} />
          <InfoRow label="E-mail" value={user.email} />
          <InfoRow label="Telefone" value={user.phone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permissões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {user.roles.length === 0 && <Badge variant="outline">cliente</Badge>}
            {user.roles.map((r) => (
              <Badge key={r} variant={r === 'admin' ? 'default' : 'secondary'} className="flex items-center gap-1">
                {r === 'admin' ? <ShieldCheck className="w-3 h-3" /> : null}
                {r}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datas</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Cadastro" value={new Date(user.created_at).toLocaleString('pt-BR')} />
          <InfoRow
            label="Último acesso"
            value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificador</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="ID" value={user.id} />
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Senha de Acesso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm">Definir nova senha manualmente</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button onClick={handleSetPassword} disabled={savingPassword || !newPassword}>
                  {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A nova senha começa a valer imediatamente. Compartilhe com o cliente por um canal seguro.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Enviar código de redefinição por email</Label>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleSendReset}
                disabled={sendingReset || !user.email}
              >
                {sendingReset ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Enviar email para {user.email || '—'}
              </Button>
              <p className="text-xs text-muted-foreground">
                O cliente recebe um código e cria uma nova senha sozinho. Válido por tempo limitado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AdminUserAddresses userId={user.id} />
      </div>
    </div>
  );
};

export default UserDetailPage;