import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { RefreshCw, Timer, Gauge, AlertTriangle, BarChart3 } from 'lucide-react';

interface Metric {
  id: string;
  created_at: string;
  source_product_id: string | null;
  load_time_ms: number;
  skeleton_time_ms: number;
  items_count: number;
  had_error: boolean;
  session_id: string | null;
}

const RANGES = [
  { value: '1', label: 'Últimas 24h' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
];

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

const RecommendationMetricsPage = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7');

  const load = async () => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - parseInt(range, 10));
    const { data, error } = await supabase
      .from('recommendation_performance_metrics' as any)
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) {
      toast({ title: 'Erro ao carregar métricas', description: error.message, variant: 'destructive' });
    } else {
      setMetrics((data || []) as unknown as Metric[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [range]);

  const stats = useMemo(() => {
    const total = metrics.length;
    if (total === 0) {
      return { total: 0, avgLoad: 0, p50: 0, p95: 0, avgSkeleton: 0, errorRate: 0, emptyRate: 0, skeletonShare: 0 };
    }
    const loads = metrics.map(m => m.load_time_ms).sort((a, b) => a - b);
    const skels = metrics.map(m => m.skeleton_time_ms);
    const sumLoad = loads.reduce((a, b) => a + b, 0);
    const sumSkel = skels.reduce((a, b) => a + b, 0);
    const errors = metrics.filter(m => m.had_error).length;
    const empty = metrics.filter(m => m.items_count === 0 && !m.had_error).length;
    return {
      total,
      avgLoad: Math.round(sumLoad / total),
      p50: percentile(loads, 50),
      p95: percentile(loads, 95),
      avgSkeleton: Math.round(sumSkel / total),
      errorRate: Math.round((errors / total) * 1000) / 10,
      emptyRate: Math.round((empty / total) * 1000) / 10,
      skeletonShare: sumLoad > 0 ? Math.round((sumSkel / sumLoad) * 1000) / 10 : 0,
    };
  }, [metrics]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Métricas de Recomendações"
        description="Tempo de carregamento e tempo em skeleton no bloco de recomendações."
        icon={BarChart3}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Gauge className="w-4 h-4" /> Amostras</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Timer className="w-4 h-4" /> Carregamento médio</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.avgLoad} ms</p>
            <p className="text-xs text-muted-foreground mt-1">P50: {stats.p50} ms · P95: {stats.p95} ms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Timer className="w-4 h-4" /> % em skeleton</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.skeletonShare}%</p>
            <p className="text-xs text-muted-foreground mt-1">Skeleton médio: {stats.avgSkeleton} ms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Erros / Vazias</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.errorRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Sem itens: {stats.emptyRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas amostras</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto origem</TableHead>
                <TableHead className="text-right">Carregamento</TableHead>
                <TableHead className="text-right">Skeleton</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.slice(0, 100).map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(m.created_at).toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="font-mono text-xs">{m.source_product_id?.slice(0, 8) ?? '-'}</TableCell>
                  <TableCell className="text-right">{m.load_time_ms} ms</TableCell>
                  <TableCell className="text-right">{m.skeleton_time_ms} ms</TableCell>
                  <TableCell className="text-right">{m.items_count}</TableCell>
                  <TableCell>
                    {m.had_error ? <Badge variant="destructive">Erro</Badge> : <Badge variant="secondary">OK</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {metrics.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem dados no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default RecommendationMetricsPage;
