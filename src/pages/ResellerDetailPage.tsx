import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const PAID = ["PAID", "CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];

export default function ResellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reseller, setReseller] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      const { data: r } = await supabase.from("resellers" as any).select("*").eq("id", id).maybeSingle();
      setReseller(r);
      const { data: o } = await supabase
        .from("orders")
        .select("id,created_at,product_name,status,total_value,reseller_commission,customer_name")
        .eq("reseller_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      setOrders(o || []);
      const { data: ev } = await supabase
        .from("reseller_events" as any)
        .select("created_at,event_type,product_name,amount,session_id,metadata")
        .eq("reseller_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      setEvents((ev as any[]) || []);
      setLoading(false);
    })();
  }, [id]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={reseller ? `${reseller.name} — últimos pedidos` : "Revendedor"}
        description={reseller?.code ? `Código: ${reseller.code}` : undefined}
        actions={
          <Button variant="outline" onClick={() => navigate("/admin/revendedores")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        }
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <>
          <Card>
            <CardContent className="p-4 space-y-3 overflow-x-auto">
              <h3 className="text-sm font-semibold">Eventos do funil (últimos 50)</h3>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Sessão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((e: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell><Badge variant="secondary">{e.event_type}</Badge></TableCell>
                        <TableCell className="text-xs">{e.metadata?.customer_name || e.metadata?.email || "—"}</TableCell>
                        <TableCell className="text-xs">{e.product_name || "—"}</TableCell>
                        <TableCell className="text-xs">{e.amount ? `R$ ${Number(e.amount).toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{e.session_id ? String(e.session_id).slice(0, 8) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3 overflow-x-auto">
              <h3 className="text-sm font-semibold">Pedidos (últimos 50)</h3>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido vinculado ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Comissão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs">{new Date(o.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>{o.customer_name}</TableCell>
                        <TableCell>{o.product_name}</TableCell>
                        <TableCell>
                          <Badge variant={PAID.includes(String(o.status).toUpperCase()) ? "default" : "secondary"}>
                            {o.status}
                          </Badge>
                        </TableCell>
                        <TableCell>R$ {Number(o.total_value || 0).toFixed(2)}</TableCell>
                        <TableCell>R$ {Number(o.reseller_commission || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
