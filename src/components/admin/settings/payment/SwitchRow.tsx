import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface Props {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}

/** Linha padrão "Label + descrição + Switch" usada em configurações de gateways. */
const SwitchRow = ({ label, description, checked, onCheckedChange, disabled }: Props) => (
  <div className="flex items-center justify-between rounded-md border border-border/50 p-3">
    <div className="min-w-0">
      <Label className="text-sm">{label}</Label>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

export default SwitchRow;