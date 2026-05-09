import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { KeyRound, Loader2, CheckCircle2, AlertTriangle, Check, X, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logoImg from '@/assets/liberty-pharma-logo.png';

type PasswordChecks = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
};

const evaluatePassword = (pwd: string): PasswordChecks => ({
  length: pwd.length >= 8,
  upper: /[A-Z]/.test(pwd),
  lower: /[a-z]/.test(pwd),
  digit: /\d/.test(pwd),
});

const strengthScore = (c: PasswordChecks) =>
  Number(c.length) + Number(c.upper) + Number(c.lower) + Number(c.digit);

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [tokenEmail, setTokenEmail] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Hash-based token (links antigos do Supabase: #access_token=...&type=recovery)
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    const url = new URL(window.location.href);

    // Token customizado (nova edge function via SMTP Hostinger)
    const customToken = url.searchParams.get('reset_token');
    if (customToken) {
      setVerifying(true);
      supabase.functions
        .invoke('verify-password-reset', { body: { token: customToken, action: 'verify' } })
        .then(({ data, error }) => {
          if (error || (data as any)?.error) {
            const msg = (data as any)?.error || 'Link inválido ou expirado. Solicite um novo link de redefinição.';
            setTokenError(msg);
            toast({
              title: 'Link inválido ou expirado',
              description: msg,
              variant: 'destructive',
            });
            return;
          }
          setResetToken(customToken);
          setTokenEmail((data as any)?.email ?? null);
          setIsRecovery(true);
        })
        .finally(() => setVerifying(false));
    }

    // Query-based token (links antigos do Supabase: ?code=... PKCE flow)
    const code = url.searchParams.get('code');
    if (code && !customToken) {
      setVerifying(true);
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          setIsRecovery(true);
          // Limpa o code da URL para evitar reutilização
          window.history.replaceState({}, '', window.location.pathname);
        } else {
          setTokenError('Link inválido ou expirado. Solicite um novo link de redefinição.');
          toast({
            title: 'Link inválido ou expirado',
            description: 'Solicite um novo link de redefinição.',
            variant: 'destructive',
          });
        }
      }).finally(() => setVerifying(false));
    }

    // Verifica se já existe sessão ativa de recovery (caso o usuário recarregue)
    if (!customToken) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setIsRecovery(true);
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const checks = evaluatePassword(password);
  const score = strengthScore(checks);
  const allValid = score === 4;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!allValid) {
      setFormError('A senha não atende aos requisitos mínimos de segurança.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      if (resetToken) {
        // Fluxo customizado via edge function
        const { data, error } = await supabase.functions.invoke('verify-password-reset', {
          body: { token: resetToken, action: 'reset', password },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
      } else {
        // Fluxo Supabase Auth padrão (sessão recovery)
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }
      setSuccess(true);
      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Você será redirecionado para o login em instantes.',
      });
      setTimeout(() => navigate('/cliente/login'), 3000);
    } catch (err: any) {
      const msg = err?.message || 'Não foi possível redefinir sua senha. Tente novamente.';
      setFormError(msg);
      toast({ title: 'Erro ao redefinir senha', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const Requirement = ({ ok, label }: { ok: boolean; label: string }) => (
    <li className="flex items-center gap-2 text-xs">
      {ok ? (
        <Check className="w-3.5 h-3.5 text-primary" />
      ) : (
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      )}
      <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  );

  const strengthLabel = ['Muito fraca', 'Fraca', 'Média', 'Boa', 'Forte'][score];
  const strengthColor = ['bg-destructive', 'bg-destructive', 'bg-amber-500', 'bg-amber-400', 'bg-primary'][score];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/50 bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <Link to="/catalogo" className="flex items-center gap-2">
            <img src={logoImg} alt="Liberty Pharma" className="h-10 object-contain" />
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-border/50">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${
              tokenError && !isRecovery ? 'bg-destructive/10' : 'bg-primary/10'
            }`}>
              {success ? (
                <CheckCircle2 className="w-7 h-7 text-primary" />
              ) : tokenError && !isRecovery ? (
                <AlertTriangle className="w-7 h-7 text-destructive" />
              ) : (
                <KeyRound className="w-7 h-7 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {success
                  ? 'Senha Redefinida!'
                  : tokenError && !isRecovery
                  ? 'Link Inválido'
                  : 'Redefinir Senha'}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {success
                  ? 'Sua senha foi alterada com sucesso. Redirecionando...'
                  : tokenError && !isRecovery
                  ? tokenError
                  : tokenEmail
                  ? `Crie uma nova senha para ${tokenEmail}`
                  : 'Digite sua nova senha abaixo'}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-4">
                <Link to="/cliente/login">
                  <Button variant="outline">Ir para o Login</Button>
                </Link>
              </div>
            ) : verifying ? (
              <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Validando link de redefinição...</p>
              </div>
            ) : !isRecovery ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-muted-foreground text-sm">
                  {tokenError ? 'O link pode ter expirado ou já ter sido utilizado.' : 'Link de recuperação inválido ou expirado.'}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Link to="/recuperar-senha">
                    <Button>Solicitar novo link</Button>
                  </Link>
                  <Link to="/cliente/login">
                    <Button variant="outline">Voltar ao Login</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      maxLength={72}
                      autoComplete="new-password"
                      className="pr-10"
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
                  {password.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full transition-all ${strengthColor}`}
                            style={{ width: `${(score / 4) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">{strengthLabel}</span>
                      </div>
                      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <Requirement ok={checks.length} label="Mín. 8 caracteres" />
                        <Requirement ok={checks.upper} label="1 letra maiúscula" />
                        <Requirement ok={checks.lower} label="1 letra minúscula" />
                        <Requirement ok={checks.digit} label="1 número" />
                      </ul>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                  />
                  {confirmPassword.length > 0 && (
                    <p className={`text-xs flex items-center gap-1 ${passwordsMatch ? 'text-primary' : 'text-destructive'}`}>
                      {passwordsMatch ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      {passwordsMatch ? 'As senhas coincidem' : 'As senhas não coincidem'}
                    </p>
                  )}
                </div>
                {formError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !allValid || !passwordsMatch}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Redefinir Senha
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
