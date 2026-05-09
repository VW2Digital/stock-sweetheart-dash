import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { GatewayKey } from '@/lib/gatewayAccounts';
import asaasLogo from '@/assets/gateway-asaas.png';
import mercadoPagoLogo from '@/assets/gateway-mercadopago.png';
import pagarMeLogo from '@/assets/gateway-pagarme.png';
import pagBankLogo from '@/assets/gateway-pagbank.png';
import AddGatewayAccountDialog from './AddGatewayAccountDialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded?: () => void;
}

const OPTIONS: { key: GatewayKey; name: string; logo: string }[] = [
  { key: 'asaas', name: 'Asaas', logo: asaasLogo },
  { key: 'mercadopago', name: 'Mercado Pago', logo: mercadoPagoLogo },
  { key: 'pagbank', name: 'PagBank', logo: pagBankLogo },
  { key: 'pagarme', name: 'Pagar.me', logo: pagarMeLogo },
];

const ChooseGatewayDialog = ({ open, onOpenChange, onAdded }: Props) => {
  const [selected, setSelected] = useState<GatewayKey | null>(null);

  return (
    <>
      <Dialog open={open && !selected} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Escolha o banco / gateway</DialogTitle>
            <DialogDescription>
              Selecione qual gateway você quer adicionar. Você pode cadastrar várias contas do mesmo gateway.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setSelected(o.key)}
                className="group aspect-square rounded-xl bg-card border border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary transition-all duration-200 overflow-hidden flex flex-col items-center justify-center gap-3 p-6"
              >
                <img src={o.logo} alt={o.name} className="w-[55%] h-[55%] object-contain group-hover:scale-105 transition-transform" />
                <span className="text-sm font-medium">{o.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {selected && (
        <AddGatewayAccountDialog
          open={!!selected}
          onOpenChange={(v) => {
            if (!v) {
              setSelected(null);
              onOpenChange(false);
            }
          }}
          gateway={selected}
          onSaved={() => {
            onAdded?.();
            setSelected(null);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
};

export default ChooseGatewayDialog;