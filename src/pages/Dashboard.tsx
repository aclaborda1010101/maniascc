import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  MapPin, Users, Sparkles, Brain, Plus, TrendingUp, Clock, ArrowRight,
  FolderOpen, DollarSign, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = ["hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(0,84%,60%)", "hsl(217,91%,60%)", "hsl(262,83%,58%)", "hsl(180,70%,45%)"];

const estadoLocalLabels: Record<string, string> = {
  disponible: "Disponible", en_negociacion: "Negociación", ocupado: "Ocupado", reforma: "Reforma",
};
const estadoMatchLabels: Record<string, string> = {
  pendiente: "Pendiente", sugerido: "Sugerido", contactado: "Contactado",
  aprobado: "Aprobado", descartado: "Descartado", exito: "Éxito",
};

interface Stats {
  proyectosActivos: number;
  totalOperadores: number;
  matchesPendientes: number;
  costeIAMes: number;
  totalLocales: number;
  latenciaMedia: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [localEstadoDist, setLocalEstadoDist] = useState<any[]>([]);
  const [matchEstadoDist, setMatchEstadoDist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        proyectosRes, operadoresRes, matchesPendRes, audMesRes,
        localesCountRes, audLatRes, recentMatchesRes, actividadRes,
        localesAllRes, matchesAllRes,
      ] = await Promise.all([
        supabase.from("proyectos").select("id", { count: "exact", head: true }).in("estado", ["activo", "en_negociacion"]),
        supabase.from("operadores").select("id", { count: "exact", head: true }),
        supabase.from("matches").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
        supabase.from("auditoria_ia").select("coste_estimado, latencia_ms").gte("created_at", startOfMonth.toISOString()),
        supabase.from("locales").select("id", { count: "exact", head: true }),
        supabase.from("auditoria_ia").select("latencia_ms").order("created_at", { ascending: false }).limit(50),
        supabase.from("matches").select("*, locales(nombre), operadores(nombre)").order("created_at", { ascending: false }).limit(8),
        supabase.from("actividad_proyecto").select("*, proyectos(nombre)").order("created_at", { ascending: false }).limit(10),
        supabase.from("locales").select("estado"),
        supabase.from("matches").select("estado"),
      ]);

      const audMes = audMesRes.data || [];
      const costeIAMes = audMes.reduce((s, r) => s + (Number(r.coste_estimado) || 0), 0);
      const latRows = audLatRes.data || [];
      const latenciaMedia = latRows.length > 0
        ? Math.round(latRows.reduce((s, r) => s + (Number(r.latencia_ms) || 0), 0) / latRows.length) : 0;

      // Distributions
      const localDist: Record<string, number> = {};
      (localesAllRes.data || []).forEach((l: any) => { localDist[l.estado] = (localDist[l.estado] || 0) + 1; });
      setLocalEstadoDist(Object.entries(localDist).map(([k, v]) => ({ name: estadoLocalLabels[k] || k, value: v })));

      const matchDist: Record<string, number> = {};
      (matchesAllRes.data || []).forEach((m: any) => { matchDist[m.estado] = (matchDist[m.estado] || 0) + 1; });
      setMatchEstadoDist(Object.entries(matchDist).map(([k, v]) => ({ name: estadoMatchLabels[k] || k, value: v })));

      setStats({
        proyectosActivos: proyectosRes.count || 0,
        totalOperadores: operadoresRes.count || 0,
        matchesPendientes: matchesPendRes.count || 0,
        costeIAMes,
        totalLocales: localesCountRes.count || 0,
        latenciaMedia,
      });
      setRecentMatches(recentMatchesRes.data || []);
      setRecentActivity(actividadRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const statCards = [
    { label: "Proyectos Activos", value: stats?.proyectosActivos, icon: FolderOpen, color: "text-primary", bg: "bg-primary/10" },
    { label: "Operadores", value: stats?.totalOperadores, icon: Users, color: "text-chart-2", bg: "bg-chart-2/10" },
    { label: "Locales", value: stats?.totalLocales, icon: MapPin, color: "text-chart-1", bg: "bg-chart-1/10" },
    { label: "Matches Pendientes", value: stats?.matchesPendientes, icon: Sparkles, color: "text-accent", bg: "bg-accent/10" },
    { label: "Coste IA (mes)", value: stats ? `${stats.costeIAMes.toFixed(3)}€` : undefined, icon: DollarSign, color: "text-chart-3", bg: "bg-chart-3/10" },
    { label: "Latencia Media IA", value: stats ? `${stats.latenciaMedia}ms` : undefined, icon: Clock, color: "text-muted-foreground", bg: "bg-muted/50" },
  ];

  const barData = recentMatches.map((m) => ({
    name: ((m.operadores as any)?.nombre || "Op").substring(0, 10),
    score: Number(m.score) || 0,
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
            <Link to="/proyectos"><Plus className="mr-1 h-4 w-4" /> Nuevo Proyecto</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/operadores"><Plus className="mr-1 h-4 w-4" /> Nuevo Operador</Link>
          </Button>
        </div>
      </div>

      {/* KPI cards */}
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

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Últimos Matches por Score</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[260px] w-full" /> : barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => [`${v}%`, "Score"]} />
                  <Bar dataKey="score" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-12 text-center">
                <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-muted-foreground">Aún no hay matches generados.</p>
                <Button asChild size="sm" variant="link" className="mt-2">
                  <Link to="/proyectos">Ir a Proyectos <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 grid-rows-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Locales por Estado</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              {loading ? <Skeleton className="h-[100px] w-full" /> : localEstadoDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={localEstadoDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={45} innerRadius={25}>
                      {localEstadoDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground">Sin locales</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Matches por Estado</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              {loading ? <Skeleton className="h-[100px] w-full" /> : matchEstadoDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={matchEstadoDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={45} innerRadius={25}>
                      {matchEstadoDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground">Sin matches</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent matches + Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Últimos Matches</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/locales">Ver todos <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40 w-full" /> : recentMatches.length > 0 ? (
              <div className="space-y-2">
                {recentMatches.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{(m.locales as any)?.nombre} ↔ {(m.operadores as any)?.nombre}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.explicacion?.substring(0, 80)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge className="bg-accent/10 text-accent">{m.score}%</Badge>
                      <Badge variant="secondary" className="capitalize text-xs">{m.estado}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="py-6 text-center text-muted-foreground">Sin matches recientes.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" /> Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40 w-full" /> : recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.descripcion}</p>
                      <p className="text-xs text-muted-foreground">{(a.proyectos as any)?.nombre || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge variant="outline" className="text-xs">{a.tipo}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("es-ES")}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-muted-foreground">Sin actividad reciente.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
