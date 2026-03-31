import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Sparkles, Loader2 } from "lucide-react";
import { queryExpertForge, EXPERT_SPECIALISTS } from "@/services/expertForge";

export default function Auditoria() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("auditoria_ia")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const totalCoste = logs.reduce((sum, l) => sum + (Number(l.coste_estimado) || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoría IA</h1>
        <p className="text-sm text-muted-foreground">Log de todas las operaciones IA, costes y latencias</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Operaciones totales</p>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tasa de éxito</p>
            <p className="text-2xl font-bold">
              {logs.length > 0 ? Math.round((logs.filter(l => l.exito).length / logs.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Coste estimado total</p>
            <p className="text-2xl font-bold">{totalCoste.toFixed(4)} €</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas operaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">No hay operaciones IA registradas aún.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Función</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Latencia</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Coste</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.funcion_ia || "—"}</TableCell>
                    <TableCell className="text-xs">{l.modelo}</TableCell>
                    <TableCell>{l.latencia_ms ? `${l.latencia_ms}ms` : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {l.tokens_entrada || 0} → {l.tokens_salida || 0}
                    </TableCell>
                    <TableCell className="text-xs">{Number(l.coste_estimado || 0).toFixed(4)} €</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={l.exito ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}>
                        {l.exito ? "OK" : "Error"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("es-ES")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
