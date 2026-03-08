import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Sparkles, DollarSign, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Stats {
  totalLocales: number;
  operadoresActivos: number;
  matchesExitosos: number;
  costeIA: number;
}

const PIE_COLORS = ["hsl(217,91%,60%)", "hsl(38,92%,50%)", "hsl(142,71%,45%)"];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [estadoDist, setEstadoDist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [localesRes, operadoresRes, matchesRes, auditoriaRes, recentRes, auditLogsRes, localesAllRes] = await Promise.all([
        supabase.from("locales").select("id", { count: "exact", head: true }),
        supabase.from("operadores").select("id", { count: "exact", head: true }).eq("activo", true),
        supabase.from("matches").select("id", { count: "exact", head: true }).eq("estado", "aprobado"),
        supabase.from("auditoria_ia").select("coste_estimado"),
        supabase.from("matches").select("*, locales(nombre), operadores(nombre)").order("created_at", { ascending: false }).limit(5),
        supabase.from("auditoria_ia").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("locales").select("estado"),
      ]);

      const costeTotal = (auditoriaRes.data || []).reduce((sum, r) => sum + (Number(r.coste_estimado) || 0), 0);

      // Compute distribution
      const dist: Record<string, number> = {};
      (localesAllRes.data || []).forEach((l: any) => {
        dist[l.estado] = (dist[l.estado] || 0) + 1;
      });
      setEstadoDist(Object.entries(dist).map(([name, value]) => ({ name: name.replace("_", " "), value })));

      setStats({
        totalLocales: localesRes.count || 0,
        operadoresActivos: operadoresRes.count || 0,
        matchesExitosos: matchesRes.count || 0,
        costeIA: costeTotal,
      });
      setRecentMatches(recentRes.data || []);
      setAuditLogs(auditLogsRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const statCards = [
    { label: "Total Locales", value: stats?.totalLocales, icon: MapPin, color: "text-chart-1" },
    { label: "Operadores Activos", value: stats?.operadoresActivos, icon: Users, color: "text-chart-2" },
    { label: "Matches Exitosos", value: stats?.matchesExitosos, icon: Sparkles, color: "text-chart-3" },
    { label: "Coste IA (€)", value: stats?.costeIA?.toFixed(2), icon: DollarSign, color: "text-chart-5" },
  ];

  const chartData = recentMatches.map((m) => ({
    name: (m.locales as any)?.nombre?.substring(0, 12) || "Local",
    score: Number(m.score) || 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Torre de Control</h1>
        <p className="text-muted-foreground">Visión general de la plataforma ATLAS</p>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold">{card.value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Últimos Matches</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-muted-foreground">Aún no hay matches generados.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Distribución por Estado</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : estadoDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={estadoDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {estadoDist.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-muted-foreground">Sin locales registrados.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Audit + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Auditoría IA</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : auditLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Coste (€)</TableHead>
                    <TableHead>Latencia</TableHead>
                    <TableHead>Éxito</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{a.modelo}</TableCell>
                      <TableCell>{Number(a.coste_estimado).toFixed(3)}</TableCell>
                      <TableCell>{a.latencia_ms}ms</TableCell>
                      <TableCell>{a.exito ? "✓" : "✗"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("es-ES")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-6 text-center text-muted-foreground">Sin registros de auditoría.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Acciones Rápidas</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="w-full justify-start bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/locales"><Plus className="mr-2 h-4 w-4" /> Nuevo Local</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/operadores"><Users className="mr-2 h-4 w-4" /> Nuevo Operador</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/locales"><Sparkles className="mr-2 h-4 w-4" /> Ejecutar Matching</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
