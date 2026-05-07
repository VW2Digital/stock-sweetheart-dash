import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, ShoppingBag, Users, ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';

interface KpiProps {
  revenueToday: number;
  revenueDelta: number;
  ordersToday: number;
  ordersDelta: number;
  totalCustomers: number;
  customersDelta: number;
}

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

function Delta({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const color = positive ? 'text-emerald-600' : 'text-destructive';
  return (
    <p className={`text-xs font-semibold inline-flex items-center gap-1 ${color}`}>
      <Icon className="w-3 h-3" />
      {positive ? '+' : ''}
      {value.toFixed(2).replace('.', ',')}% vs ontem
    </p>
  );
}

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  delta: number;
  icon: LucideIcon;
  tint: string;
}) {
  return (
    <Card className="border-border/60 shadow-sm overflow-hidden relative bg-card rounded-2xl">
      <CardContent className={`p-5 ${tint} relative`}>
        <div className="flex items-start justify-between mb-3 relative z-10">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-foreground mb-2 tracking-tight relative z-10">
          {value}
        </p>
        <div className="relative z-10">
          <Delta value={delta} />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardTopKpis({
  revenueToday,
  revenueDelta,
  ordersToday,
  ordersDelta,
  totalCustomers,
  customersDelta,
}: KpiProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard
        label="Receita Hoje"
        value={formatBRL(revenueToday)}
        delta={revenueDelta}
        icon={DollarSign}
        tint=""
      />
      <KpiCard
        label="Pedidos Hoje"
        value={ordersToday.toString()}
        delta={ordersDelta}
        icon={ShoppingBag}
        tint=""
      />
      <KpiCard
        label="Clientes"
        value={totalCustomers.toLocaleString('pt-BR')}
        delta={customersDelta}
        icon={Users}
        tint=""
      />
    </div>
  );
}