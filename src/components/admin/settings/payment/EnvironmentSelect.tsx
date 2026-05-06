import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

/** Sandbox / Produção selector — used by every gateway. */
const EnvironmentSelect = ({ value, onChange }: Props) => (
  <div className="space-y-2">
    <Label>Ambiente</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
        <SelectItem value="production">Produção</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export default EnvironmentSelect;