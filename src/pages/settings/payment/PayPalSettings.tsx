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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props { isActive: boolean; onActivate: () => void }

const PayPalSettings = ({ isActive, onActivate }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [webhookId, setWebhookId] = useState('');
  const [env, setEnv] = useState('production');
  const { testing, test } = useGatewayConnectionTest('paypal');

  useEffect(() => {
    Promise.all([
      fetchSetting('paypal_client_id'),
      fetchSetting('paypal_client_secret'),
      fetchSetting('paypal_environment'),
      fetchSetting('paypal_webhook_id'),
    ]).then(([id, sec, e, wid]) => {
      setClientId(id || '');
      setClientSecret(sec || '');
      setEnv(e || 'production');
      setWebhookId(wid || '');
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Não autenticado');
      await Promise.all([
        upsertSetting('paypal_client_id', clientId, user.id),
        upsertSetting('paypal_client_secret', clientSecret, user.id),
        upsertSetting('paypal_environment', env, user.id),
        upsertSetting('paypal_webhook_id', webhookId, user.id),
      ]);
      if (!isActive) {
        await upsertSetting('payment_gateway', 'paypal', user.id);
        onActivate();
      }
      toast({ title: 'PayPal salvo!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="space-y-4">
      <GatewayToggles gateway="paypal" fallbackSupported={false} />
      <EnvironmentSelect value={env} onChange={setEnv} />

      <div className="space-y-2">
        <Label>Client ID</Label>
        <Input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Client ID do app PayPal (Live)"
        />
        <p className="text-xs text-muted-foreground">
          developer.paypal.com → My Apps &amp; Credentials → Live → seu app.
        </p>
      </div>

      <PasswordField
        label="Client Secret"
        value={clientSecret}
        onChange={setClientSecret}
        placeholder="Secret do app PayPal"
      />

      <div className="space-y-2">
        <Label>Webhook ID (opcional)</Label>
        <Input
          value={webhookId}
          onChange={(e) => setWebhookId(e.target.value)}
          placeholder="ID do webhook cadastrado no painel PayPal"
        />
        <p className="text-xs text-muted-foreground">
          Permite validar assinatura dos eventos recebidos via PayPal-Auth-Algo.
        </p>
      </div>

      <WebhookUrlCard
        gatewayName="PayPal"
        functionSlug="paypal-webhook"
        cadastroHint="no painel do PayPal, em Account Settings → Webhooks → Add Webhook"
        eventos={[
          "CHECKOUT.ORDER.APPROVED",
          "PAYMENT.CAPTURE.COMPLETED",
          "PAYMENT.CAPTURE.DENIED",
          "PAYMENT.CAPTURE.REFUNDED",
          "PAYMENT.CAPTURE.REVERSED",
        ]}
      />
      <SaveTestButtons
        isActive={isActive}
        saving={saving}
        testing={testing}
        testDisabled={!clientId || !clientSecret}
        onSave={handleSave}
        onTest={() => test(`${clientId}:${clientSecret}`, env)}
      />
    </div>
  );
};

export default PayPalSettings;
