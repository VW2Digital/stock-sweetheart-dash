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

const AsaasSettings = ({ isActive, onActivate }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [env, setEnv] = useState('sandbox');
  const { testing, test } = useGatewayConnectionTest('asaas');

  useEffect(() => {
    Promise.all([
      fetchSetting('asaas_api_key'),
      fetchSetting('asaas_environment'),
      fetchSetting('asaas_webhook_token'),
    ]).then(([k, e, w]) => {
      setApiKey(k || ''); setEnv(e || 'sandbox'); setWebhookToken(w || '');
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Não autenticado');
      await Promise.all([
        upsertSetting('asaas_api_key', apiKey, user.id),
        upsertSetting('asaas_environment', env, user.id),
        upsertSetting('asaas_webhook_token', webhookToken, user.id),
      ]);
      if (!isActive) {
        await upsertSetting('payment_gateway', 'asaas', user.id);
        onActivate();
      }
      toast({ title: 'Asaas salvo!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="space-y-4">
      <GatewayToggles gateway="asaas" />
      <EnvironmentSelect value={env} onChange={setEnv} />
      <PasswordField label="API Key" value={apiKey} onChange={setApiKey} placeholder="$aact_..." />
      <PasswordField label="Token de Autenticação do Webhook" value={webhookToken} onChange={setWebhookToken} placeholder="Token definido no Asaas" />
      <WebhookUrlCard
        gatewayName="Asaas"
        functionSlug="asaas-webhook"
        cadastroHint="no painel do Asaas, em Integrações → Webhooks"
        eventos={["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED"]}
      />
      <SaveTestButtons
        isActive={isActive}
        saving={saving}
        testing={testing}
        testDisabled={!apiKey}
        onSave={handleSave}
        onTest={() => test(apiKey, env)}
      />
    </div>
  );
};

export default AsaasSettings;
