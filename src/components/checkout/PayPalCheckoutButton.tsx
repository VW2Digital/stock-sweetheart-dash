/**
 * Reusable PayPal Smart Buttons component. Renders the official PayPal
 * checkout button that, when clicked, opens the PayPal popup, calls our
 * backend to create the order, and on approval captures it.
 *
 * Usage:
 *   <PayPalCheckoutButton
 *      amount={199.90}
 *      currency="BRL"
 *      orderId={localOrderId}
 *      description="Pedido #1234"
 *      onSuccess={() => navigate('/sucesso')}
 *      onError={(e) => toast(e.message)}
 *   />
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchSetting } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface Props {
  amount: number;
  currency?: 'BRL' | 'USD' | 'EUR';
  orderId?: string;
  description?: string;
  disabled?: boolean;
  onSuccess?: (result: any) => void;
  onError?: (err: Error) => void;
}

declare global {
  interface Window { paypal?: any }
}

let sdkPromise: Promise<void> | null = null;

function loadPayPalSdk(clientId: string, currency: string): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-paypal-sdk]') as HTMLScriptElement | null;
    if (existing && window.paypal) { resolve(); return; }
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar PayPal SDK')));
      return;
    }
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture`;
    s.dataset.paypalSdk = '1';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar PayPal SDK'));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

const PayPalCheckoutButton = ({ amount, currency = 'BRL', orderId, description, disabled, onSuccess, onError }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const clientId = await fetchSetting('paypal_client_id');
        if (!clientId) throw new Error('PayPal não configurado (client_id ausente)');
        await loadPayPalSdk(clientId, currency);
        if (cancelled || !containerRef.current || !window.paypal) return;

        containerRef.current.innerHTML = '';
        window.paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
          createOrder: async () => {
            const { data, error } = await supabase.functions.invoke('paypal-create-order', {
              body: { amount, currency, order_id: orderId, description },
            });
            if (error || data?.error) throw new Error(data?.error || error?.message || 'Falha ao criar ordem PayPal');
            return data.id;
          },
          onApprove: async (data: any) => {
            const { data: cap, error: capErr } = await supabase.functions.invoke('paypal-capture-order', {
              body: { paypal_order_id: data.orderID, order_id: orderId },
            });
            if (capErr || cap?.error) throw new Error(cap?.error || capErr?.message || 'Falha ao capturar pagamento');
            onSuccess?.(cap);
          },
          onError: (err: any) => {
            console.error('[PayPal Buttons]', err);
            onError?.(err instanceof Error ? err : new Error(String(err)));
          },
        }).render(containerRef.current);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
        onError?.(e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, currency, orderId]);

  if (error) {
    return <div className="text-sm text-destructive p-3 rounded border border-destructive/30 bg-destructive/5">{error}</div>;
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando PayPal…
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
};

export default PayPalCheckoutButton;
