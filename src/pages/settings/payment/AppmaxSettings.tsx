import SettingsSkeleton from '@/components/admin/settings/SettingsSkeleton';
import { useState, useEffect } from 'react';
import { fetchSetting, upsertSetting, getCurrentUser } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import WebhookUrlCard from '@/components/admin/WebhookUrlCard';
import GatewayToggles from '@/components/admin/settings/GatewayToggles';
import EnvironmentSelect from '@/components/admin/settings/payment/EnvironmentSelect';
import PasswordField from '@/components/admin/settings/payment/PasswordField';
import SaveTestButtons from '@/components/admin/settings/payment/SaveTestButtons';
import { useGatewayConnectionTest } from '@/components/admin/settings/payment/useGatewayConnectionTest';

interface Props { isActive: boolean; onActivate: () => void }

const AppmaxSettings = ({ isActive, onActivate }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [env, setEnv] = useState('production');
  const { testing, test } = useGatewayConnectionTest('appmax');

  useEffect(() => {
    Promise.all([
      fetchSetting('appmax_access_token'),
      fetchSetting('appmax_environment'),
      fetchSetting('appmax_webhook_secret'),
    ]).then(([t, e, w]) => {
      setAccessToken(t || '');
      setEnv(e || 'production');
      setWebhookSecret(w || '');
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Não autenticado');
      await Promise.all([
        upsertSetting('appmax_access_token', accessToken, user.id),
        upsertSetting('appmax_environment', env, user.id),
        upsertSetting('appmax_webhook_secret', webhookSecret, user.id),
      ]);
      if (!isActive) {
        await upsertSetting('payment_gateway', 'appmax', user.id);
        onActivate();
      }
      toast({ title: 'Appmax salvo!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="space-y-4">
      <GatewayToggles gateway="appmax" />
      <EnvironmentSelect value={env} onChange={setEnv} />
      <PasswordField
        label="Access Token (API Key)"
        value={accessToken}
        onChange={setAccessToken}
        placeholder="Token de produção da Appmax"
        hint="Encontre em: Painel Appmax → Configurações → Integrações → API."
      />
      <PasswordField
        label="Webhook Secret (opcional)"
        value={webhookSecret}
        onChange={setWebhookSecret}
        placeholder="Segredo HMAC do webhook (se configurado)"
      />
      <WebhookUrlCard
        gatewayName="Appmax"
        functionSlug="appmax-webhook"
        cadastroHint="no painel da Appmax, em Integrações → Postback / Webhook"
        eventos={["OrderPaid", "OrderPaidByPix", "OrderRefund", "OrderPixExpired", "PaymentNotAuthorized"]}
      />
      <SaveTestButtons
        isActive={isActive}
        saving={saving}
        testing={testing}
        testDisabled={!accessToken}
        onSave={handleSave}
        onTest={() => test(accessToken, env)}
      />
    </div>
  );
};

export default AppmaxSettings;
