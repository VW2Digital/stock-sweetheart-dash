import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { KeyRound, Loader2, CheckCircle2, AlertTriangle, Check, X, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logoImg from '@/assets/liberty-pharma-logo.png';
import { useLanguage } from '@/contexts/LanguageContext';

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

const formatCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

const ResetPassword = () => {
  const initialEmail = new URL(window.location.href).searchParams.get('email') ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const checks = evaluatePassword(password);
  const score = strengthScore(checks);
  const allValid = score === 4;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const normalizedEmail = email.trim().toLowerCase();

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setNeedsNewCode(false);

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError(t('enterRecoveryEmail'));
      return;
    }

    if (code.length !== 8) {
      setFormError(t('paste8CharCode'));
      return;
    }

    setVerifyingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-password-reset', {
        body: { email: normalizedEmail, code, action: 'verify' },
      });
      const payload = (data as any) ?? {};
      if (error) {
        const ctx: any = (error as any).context;
        const ctxMsg = ctx?.error || ctx?.message;
        const ctxCode = ctx?.code;
        const e2: any = new Error(ctxMsg || error.message);
        e2.code = ctxCode;
        throw e2;
      }
      if (payload.error) {
        const e2: any = new Error(payload.error);
        e2.code = payload.code;
        throw e2;
      }

      setEmail(normalizedEmail);
      setCodeVerified(true);
      toast({
        title: t('codeValidated'),
        description: t('canCreateNewPassword'),
      });
    } catch (err: any) {
      const code = err?.code;
      const msg =
        err?.message ||
        t('couldNotValidateCode');
      setFormError(msg);
      setNeedsNewCode(code === 'expired' || code === 'invalid_code' || code === 'used');
      toast({
        title: code === 'expired' ? t('codeExpired') : t('invalidCode'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!codeVerified) {
      setFormError(t('validateCodeBeforeChangingPassword'));
      return;
    }
    if (!allValid) {
      setFormError(t('passwordDoesNotMeetRequirements'));
      return;
    }
    if (password !== confirmPassword) {
      setFormError(t('passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-password-reset', {
        body: { email: normalizedEmail, code, action: 'reset', password },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setSuccess(true);
      toast({
        title: t('passwordResetSuccess'),
        description: t('redirectingToLoginSoon'),
      });
      setTimeout(() => navigate('/cliente/login'), 3000);
    } catch (err: any) {
      const msg = err?.message || t('couldNotResetPassword');
      setFormError(msg);
      toast({ title: t('passwordResetError'), description: msg, variant: 'destructive' });
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

  const strengthLabel = [t('veryWeak'), t('weak'), t('medium'), t('good'), t('strong')][score];
  const strengthColor = ['bg-destructive', 'bg-destructive', 'bg-secondary', 'bg-primary/70', 'bg-primary'][score];

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
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center bg-primary/10">
              {success ? (
                <CheckCircle2 className="w-7 h-7 text-primary" />
              ) : codeVerified ? (
                <CheckCircle2 className="w-7 h-7 text-primary" />
              ) : (
                <KeyRound className="w-7 h-7 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {success ? t('passwordResetDone') : codeVerified ? t('createNewPassword') : t('validateCode')}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {success
                  ? t('passwordChangedRedirecting')
                  : codeVerified
                  ? t('codeValidatedForEmail', { email })
                  : t('pasteCodeToChangePassword')}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-4">
                <Link to="/cliente/login">
                  <Button variant="outline">{t('goToLogin')}</Button>
                </Link>
              </div>
            ) : !codeVerified ? (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recovery-code">{t('recoveryCode')}</Label>
                  <Input
                    id="recovery-code"
                    inputMode="text"
                    placeholder="ABCD2345"
                    value={code}
                    onChange={(e) => setCode(formatCode(e.target.value))}
                    required
                    maxLength={8}
                    autoComplete="one-time-code"
                    className="text-center text-lg tracking-[0.35em] font-semibold uppercase"
                  />
                </div>
                {formError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <p>{formError}</p>
                      {needsNewCode && (
                        <Link
                          to="/recuperar-senha"
                          className="inline-block font-semibold underline underline-offset-2 hover:opacity-80"
                        >
                          {t('requestNewCodeNow')}
                        </Link>
                      )}
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={verifyingCode}>
                  {verifyingCode ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('validateCode')}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {t('codeValidFor10Minutes')}
                </p>
                <Link to="/recuperar-senha" className="block">
                  <Button type="button" variant="ghost" className="w-full">
                    {t('requestNewCode')}
                  </Button>
                </Link>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t('newPassword')}</Label>
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
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
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
                        <Requirement ok={checks.length} label={t('min8Characters')} />
                        <Requirement ok={checks.upper} label={t('oneUppercaseLetter')} />
                        <Requirement ok={checks.lower} label={t('oneLowercaseLetter')} />
                        <Requirement ok={checks.digit} label={t('oneNumber')} />
                      </ul>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t('confirmNewPassword')}</Label>
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
                      {passwordsMatch ? t('passwordsMatch') : t('passwordsDoNotMatch')}
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
                  {t('resetPassword')}
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
