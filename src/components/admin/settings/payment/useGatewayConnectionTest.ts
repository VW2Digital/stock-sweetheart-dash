import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CheckoutGateway } from '@/services/payments/paymentFactory';

/** Centralized test-connection hook that calls `payment-checkout`. */
export function useGatewayConnectionTest(gateway: CheckoutGateway) {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);

  const test = async (apiKey: string, environment: string) => {
    setTesting(true);
    try {
      const body: Record<string, string> = {
        action: 'test_connection',
        environment,
        api_key: apiKey,
      };
      // Asaas is the legacy default and doesn't require the gateway field.
      if (gateway !== 'asaas') body.gateway = gateway;
      const { data, error } = await supabase.functions.invoke('payment-checkout', { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Conexão OK!',
        description: `Ambiente: ${environment === 'production' ? 'Produção' : 'Sandbox'}`,
      });
    } catch (err: any) {
      toast({ title: 'Falha na conexão', description: err.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return { testing, test };
}