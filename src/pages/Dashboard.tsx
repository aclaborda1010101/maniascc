import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Sparkles, Brain, Plus, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PIE_COLORS_LOCALES = ["hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(0,84%,60%)", "hsl(217,91%,60%)"];
const PIE_COLORS_MATCHES = ["hsl(38,92%,50%)", "hsl(217,91%,60%)", "hsl(142,71%,45%)", "hsl(0,84%,60%)", "hsl(262,83%,58%)", "hsl(180,70%,45%)"];

const estadoLocalLabels: Record<string, string> = {
  disponible: "Disponible",
  en_negociacion: "Negociación",
  ocupado: "Ocupado",
  reforma: "Reforma",
};

const estadoMatchLabels: Record<string, string> = {
  pendiente: "Pendiente",
  sugerido: "Sugerido",
  contactado: "Contactado",
  aprobado: "Aprobado",
  descartado: "Descartado",
  exito: "Éxito",
};

export default function Dashboard() {
  const [stats, setStats] = useState<{
    totalLocales: number; operadoresActivos: number; totalMatches: number;
    matchesExitosos: number; costeIA: number;
    latenciaMedia: number; totalAudits: number;
  } | null>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [localEstadoDist, setLocalEstadoDist] = useState<any[]>([]);
  const [matchEstadoDist, setMatchEstadoDist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [
        localesCountRes, operadoresCountRes, matchesCountRes, matchesExitoRes,
        auditoriaRes, recentRes, auditLogsRes, localesAllRes, matchesAllRes,
      ] = await Promise.all([
        supabase.from("locales").select("id", { count: "exact", head: true }),
        supabase.from("operadores").select("id", { count: "exact", head: true }).eq("activo", true),
        supabase.from("matches").select("id", { count: "exact", head: true }),
        supabase.from("matches").select("id", { count: "exact", head: true }).in("estado", ["aprobado", "contactado", "exito"]),
        supabase.from("auditoria_ia").select("coste_estimado, latencia_ms"),
        supabase.from("matches").select("*, locales(nombre), operadores(nombre)").order("created_at", { ascending: false }).limit(8),
        supabase.from("auditoria_ia").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("locales").select("estado"),
        supabase.from("matches").select("estado"),
      ]);

      const audits = auditoriaRes.data || [];
      const costeTotal = audits.reduce((sum, r) => sum + (Number(r.coste_estimado) || 0), 0);
      const latenciaMedia = audits.length > 0
        ? Math.round(audits.reduce((sum, r) => sum + (Number(r.latencia_ms) || 0), 0) / audits.length)
        : 0;

      // Local distribution
      const localDist: Record<string, number> = {};
      (localesAllRes.data || []).forEach((l: any) => {
        localDist[l.estado] = (localDist[l.estado] || 0) + 1;
      });
      setLocalEstadoDist(Object.entries(localDist).map(([key, value]) => ({
        name: estadoLocalLabels[key] || key,
        value,
      })));

      // Match distribution
      const matchDist: Record<string, number> = {};
      (matchesAllRes.data || []).forEach((m: any) => {
        matchDist[m.estado] = (matchDist[m.estado] || 0) + 1;
      });
      setMatchEstadoDist(Object.entries(matchDist).map(([key, value]) => ({
        name: estadoMatchLabels[key] || key,
        value,
      })));

      setStats({
        totalLocales: localesCountRes.count || 0,
        operadoresActivos: operadoresCountRes.count || 0,
        totalMatches: matchesCountRes.count || 0,
        matchesExitosos: matchesExitoRes.count || 0,
        costeIA: costeTotal,
        latenciaMedia,
        totalAudits: audits.length,
      });
      setRecentMatches(recentRes.data || []);
      setAuditLogs(auditLogsRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const statCards = [
    { label: "Locales", value: stats?.totalLocales, icon: MapPin, color: "text-chart-1", bg: "bg-chart-1/10" },
    { label: "Operadores Activos", value: stats?.operadoresActivos, icon: Users, color: "text-chart-2", bg: "bg-chart-2/10" },
    { label: "Matches Totales", value: stats?.totalMatches, icon: Sparkles, color: "text-accent", bg: "bg-accent/10" },
    { label: "Matches Exitosos", value: stats?.matchesExitosos, icon: TrendingUp, color: "text-chart-2", bg: "bg-chart-2/10" },
    { label: "Latencia Media IA", value: stats ? `${stats.latenciaMedia}ms` : undefined, icon: Clock, color: "text-chart-3", bg: "bg-chart-3/10" },
  ];

  const barData = recentMatches.map((m) => ({
    name: ((m.operadores as any)?.nombre || "Op").substring(0, 10),
    score: Number(m.score) || 0,
    local: ((m.locales as any)?.nombre || "").substring(0, 15),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Torre de Control</h1>
          <p className="text-sm text-muted-foreground">Visión general de la plataforma ATLAS</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/locales"><Plus className="mr-1 h-4 w-4" /> Nuevo Local</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/operadores"><Plus className="mr-1 h-4 w-4" /> Nuevo Operador</Link>
          </Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="py-4 px-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <div className={`h-7 w-7 rounded-full ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                </div>
              </div>
              {loading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold">{card.value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Últimos Matches por Score</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    formatter={(value: number) => [`${value}%`, "Score"]}
                    labelFormatter={(label) => `Operador: ${label}`}
                  />
                  <Bar dataKey="score" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-12 text-center">
                <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-muted-foreground">Aún no hay matches generados.</p>
                <Button asChild size="sm" variant="link" className="mt-2">
                  <Link to="/locales">Ir a Locales para generar matches <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 grid-rows-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Locales por Estado</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {loading ? (
                <Skeleton className="h-[100px] w-full" />
              ) : localEstadoDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={localEstadoDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={45} innerRadius={25}>
                      {localEstadoDist.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS_LOCALES[i % PIE_COLORS_LOCALES.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Sin locales</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Matches por Estado</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {loading ? (
                <Skeleton className="h-[100px] w-full" />
              ) : matchEstadoDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={matchEstadoDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={45} innerRadius={25}>
                      {matchEstadoDist.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS_MATCHES[i % PIE_COLORS_MATCHES.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Sin matches</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent matches + Audit */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Últimos Matches</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/locales">Ver todos <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : recentMatches.length > 0 ? (
              <div className="space-y-2">
                {recentMatches.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {(m.locales as any)?.nombre} ↔ {(m.operadores as any)?.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.explicacion?.substring(0, 80)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge className="bg-accent/10 text-accent">{m.score}%</Badge>
                      <Badge variant="secondary" className="capitalize text-xs">{m.estado}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-muted-foreground">Sin matches recientes.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-accent" /> Auditoría IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : auditLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Modelo</TableHead>
                    <TableHead className="text-xs">Función</TableHead>
                    <TableHead className="text-xs text-right">Latencia</TableHead>
                    <TableHead className="text-xs text-center">Estado</TableHead>
                    <TableHead className="text-xs text-right">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs font-medium">{a.modelo}</TableCell>
                      <TableCell className="text-xs">{a.funcion_ia || "matching"}</TableCell>
                      <TableCell className="text-xs text-right">{a.latencia_ms}ms</TableCell>
                      <TableCell className="text-center">
                        {a.exito ? (
                          <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 text-xs">✓</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">✗</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("es-ES")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-6 text-center">
                <Brain className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-muted-foreground">Sin registros de auditoría IA.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
