import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  MapPin, Users, Sparkles, Brain, Plus, TrendingUp, Clock, ArrowRight,
  FolderOpen, DollarSign, Activity, Eye, Zap, CheckCircle, XCircle,
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

const AGENT_LABELS: Record<string, { label: string; icon: string }> = {
  "matching": { label: "NEXUS — Matching", icon: "🔗" },
  "generate-match": { label: "NEXUS — Matching", icon: "🔗" },
  "tenant-mix-avanzado": { label: "NEXUS — Tenant Mix", icon: "🧩" },
  "validacion-retorno": { label: "RADAR — Validación", icon: "📡" },
  "localizacion-patrones": { label: "AVA — Localización", icon: "🗺️" },
  "perfil-negociador": { label: "PULSE — Negociación", icon: "🤝" },
  "rag-proxy": { label: "RAG — Consultas", icon: "📚" },
  "rag-proxy:contratos": { label: "RAG — Contratos", icon: "📄" },
  "rag-proxy:operadores": { label: "RAG — Operadores", icon: "🏪" },
  "rag-proxy:activos": { label: "RAG — Activos", icon: "🏢" },
  "rag-proxy:mercado": { label: "RAG — Mercado", icon: "📈" },
  "rag-proxy:personas": { label: "RAG — Personas", icon: "👤" },
  "rag-proxy:general": { label: "RAG — General", icon: "📁" },
  "forge:dossier_operador": { label: "FORGE — Dossier", icon: "📋" },
  "forge:presentacion_comercial": { label: "FORGE — Presentación", icon: "📊" },
  "forge:borrador_contrato": { label: "FORGE — Contrato", icon: "📝" },
  "forge:plan_estrategico": { label: "FORGE — Plan", icon: "🎯" },
  "forge:informe_war_room": { label: "FORGE — War Room", icon: "⚡" },
  "forge:email_comunicacion": { label: "FORGE — Email", icon: "✉️" },
};

interface Stats {
  proyectosActivos: number;
  totalOperadores: number;
  matchesPendientes: number;
  costeIAMes: number;
  totalLocales: number;
  latenciaMedia: number;
}

interface AuditRow {
  funcion_ia: string | null;
  modelo: string;
  latencia_ms: number | null;
  coste_estimado: number | null;
  exito: boolean;
  tokens_entrada: number | null;
  tokens_salida: number | null;
  created_at: string;
}

interface AgentStats {
  funcion: string;
  label: string;
  icon: string;
  modelo: string;
  calls: number;
  exitos: number;
  fallos: number;
  tasaExito: number;
  latenciaMedia: number;
  costeTotal: number;
  tokensIn: number;
  tokensOut: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [localEstadoDist, setLocalEstadoDist] = useState<any[]>([]);
  const [matchEstadoDist, setMatchEstadoDist] = useState<any[]>([]);
  const [matchScoreDist, setMatchScoreDist] = useState<any[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        proyectosRes, operadoresRes, matchesPendRes, audMesRes,
        localesCountRes, audLatRes, recentMatchesRes, actividadRes,
        localesAllRes, matchesAllRes, audFullRes,
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
        supabase.from("matches").select("estado, score"),
        supabase.from("auditoria_ia").select("funcion_ia, modelo, latencia_ms, coste_estimado, exito, tokens_entrada, tokens_salida, created_at").gte("created_at", startOfMonth.toISOString()).order("created_at", { ascending: false }).limit(500),
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
      const scoreBuckets = { "0-30": 0, "31-50": 0, "51-70": 0, "71-85": 0, "86-100": 0 };
      (matchesAllRes.data || []).forEach((m: any) => {
        matchDist[m.estado] = (matchDist[m.estado] || 0) + 1;
        const s = Number(m.score) || 0;
        if (s <= 30) scoreBuckets["0-30"]++;
        else if (s <= 50) scoreBuckets["31-50"]++;
        else if (s <= 70) scoreBuckets["51-70"]++;
        else if (s <= 85) scoreBuckets["71-85"]++;
        else scoreBuckets["86-100"]++;
      });
      setMatchEstadoDist(Object.entries(matchDist).map(([k, v]) => ({ name: estadoMatchLabels[k] || k, value: v })));
      setMatchScoreDist(Object.entries(scoreBuckets).map(([k, v]) => ({ range: k, count: v })));

      setAuditRows((audFullRes.data || []) as AuditRow[]);

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

  // Compute agent stats from audit rows
  const agentStats = useMemo<AgentStats[]>(() => {
    const map = new Map<string, { modelo: string; calls: number; exitos: number; fallos: number; latSum: number; costeSum: number; tokensIn: number; tokensOut: number }>();
    for (const r of auditRows) {
      const fn = r.funcion_ia || "unknown";
      let entry = map.get(fn);
      if (!entry) {
        entry = { modelo: r.modelo, calls: 0, exitos: 0, fallos: 0, latSum: 0, costeSum: 0, tokensIn: 0, tokensOut: 0 };
        map.set(fn, entry);
      }
      entry.calls++;
      if (r.exito) entry.exitos++; else entry.fallos++;
      entry.latSum += Number(r.latencia_ms) || 0;
      entry.costeSum += Number(r.coste_estimado) || 0;
      entry.tokensIn += Number(r.tokens_entrada) || 0;
      entry.tokensOut += Number(r.tokens_salida) || 0;
      entry.modelo = r.modelo; // latest model
    }
    return Array.from(map.entries())
      .map(([fn, e]) => {
        const info = AGENT_LABELS[fn] || { label: fn, icon: "🤖" };
        return {
          funcion: fn,
          label: info.label,
          icon: info.icon,
          modelo: e.modelo,
          calls: e.calls,
          exitos: e.exitos,
          fallos: e.fallos,
          tasaExito: e.calls > 0 ? Math.round((e.exitos / e.calls) * 100) : 0,
          latenciaMedia: e.calls > 0 ? Math.round(e.latSum / e.calls) : 0,
          costeTotal: e.costeSum,
          tokensIn: e.tokensIn,
          tokensOut: e.tokensOut,
        };
      })
      .sort((a, b) => b.calls - a.calls);
  }, [auditRows]);

  const modelDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of auditRows) {
      const m = r.modelo || "unknown";
      map.set(m, (map.get(m) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name: name.replace("google/", ""), value }));
  }, [auditRows]);

  const statCards = [
    { label: "Oportunidades Activas", value: stats?.proyectosActivos, icon: FolderOpen, color: "text-primary", bg: "bg-primary/10" },
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
          <p className="text-sm text-muted-foreground"><p className="text-sm text-muted-foreground">Visión general de la plataforma AVA</p></p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/oportunidades"><Plus className="mr-1 h-4 w-4" /> Nueva Oportunidad</Link>
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

      {/* ===== OBSERVABILIDAD IA ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" /> Observabilidad IA — Rendimiento por Agente (mes actual)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-40 w-full" /> : agentStats.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Sin llamadas IA este mes.</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agente</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead className="text-center">Llamadas</TableHead>
                      <TableHead className="text-center">Tasa Éxito</TableHead>
                      <TableHead className="text-center">Latencia Media</TableHead>
                      <TableHead className="text-center">Tokens (In/Out)</TableHead>
                      <TableHead className="text-right">Coste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentStats.map((a) => (
                      <TableRow key={a.funcion}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{a.icon}</span>
                            <span className="font-medium text-sm">{a.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {a.modelo.replace("google/", "")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">{a.calls}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {a.tasaExito >= 90 ? (
                              <CheckCircle className="h-3.5 w-3.5 text-chart-2" />
                            ) : a.tasaExito >= 70 ? (
                              <Zap className="h-3.5 w-3.5 text-chart-3" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            )}
                            <span className={a.tasaExito >= 90 ? "text-chart-2" : a.tasaExito >= 70 ? "text-chart-3" : "text-destructive"}>
                              {a.tasaExito}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={a.latenciaMedia > 5000 ? "text-destructive" : a.latenciaMedia > 2000 ? "text-chart-3" : "text-chart-2"}>
                            {a.latenciaMedia.toLocaleString()}ms
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {a.tokensIn.toLocaleString()} / {a.tokensOut.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">{a.costeTotal.toFixed(3)}€</TableCell>
                      </TableRow>
                    ))}
                    {/* Totals */}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-center">{agentStats.reduce((s, a) => s + a.calls, 0)}</TableCell>
                      <TableCell className="text-center">
                        {agentStats.length > 0
                          ? Math.round(agentStats.reduce((s, a) => s + a.exitos, 0) / agentStats.reduce((s, a) => s + a.calls, 0) * 100)
                          : 0}%
                      </TableCell>
                      <TableCell className="text-center">
                        {agentStats.length > 0
                          ? Math.round(agentStats.reduce((s, a) => s + a.latenciaMedia * a.calls, 0) / agentStats.reduce((s, a) => s + a.calls, 0))
                          : 0}ms
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {agentStats.reduce((s, a) => s + a.tokensIn, 0).toLocaleString()} / {agentStats.reduce((s, a) => s + a.tokensOut, 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{agentStats.reduce((s, a) => s + a.costeTotal, 0).toFixed(3)}€</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Model distribution pie */}
              {modelDistribution.length > 1 && (
                <div className="flex items-center justify-center">
                  <div className="w-full max-w-xs">
                    <p className="text-xs font-medium text-muted-foreground text-center mb-2">Distribución de modelos</p>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={modelDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={28}>
                          {modelDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                  <Link to="/oportunidades">Ir a Oportunidades <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Distribución de Scores</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[260px] w-full" /> : matchScoreDist.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={matchScoreDist} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => [v, "Matches"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {matchScoreDist.map((_, i) => (
                      <Cell key={i} fill={["hsl(0,84%,60%)", "hsl(38,92%,50%)", "hsl(48,96%,53%)", "hsl(142,71%,45%)", "hsl(217,91%,60%)"][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="py-12 text-center text-muted-foreground">Sin matches</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Locales por Estado</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center">
            {loading ? <Skeleton className="h-[140px] w-full" /> : localEstadoDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={localEstadoDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={28}>
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
            {loading ? <Skeleton className="h-[140px] w-full" /> : matchEstadoDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={matchEstadoDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={28}>
                    {matchEstadoDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">Sin matches</p>}
          </CardContent>
        </Card>
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