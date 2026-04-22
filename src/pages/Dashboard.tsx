import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Users, Sparkles, Plus, Clock, ArrowRight,
  FolderOpen, DollarSign, Activity, Bell,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = ["hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(0,84%,60%)", "hsl(217,91%,60%)", "hsl(262,83%,58%)", "hsl(180,70%,45%)"];

// Tarifas oficiales en USD por 1M tokens. El factor 0.92 (USD→EUR) se aplica en estimateCostFromTokens.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Pro tier
  "google/gemini-3.1-pro-preview": { input: 1.25, output: 10.0 },
  "google/gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "gemini-3.1-pro-preview": { input: 1.25, output: 10.0 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
  // Flash tier
  "google/gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  // Flash-lite / 3.x flash (más baratos)
  "google/gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
  "gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
  "google/gemini-3-flash-preview": { input: 0.10, output: 0.40 },
  "gemini-3-flash-preview": { input: 0.10, output: 0.40 },
  "google/gemini-3.1-flash": { input: 0.10, output: 0.40 },
  "gemini-3.1-flash": { input: 0.10, output: 0.40 },
};
// Por defecto asumimos Flash (no Pro) para no inflar costes desconocidos.
const DEFAULT_PRICING = { input: 0.15, output: 0.60 };

function estimateCostFromTokens(modelo: string, tokensIn: number, tokensOut: number): number {
  const rates = MODEL_PRICING[modelo] || DEFAULT_PRICING;
  return (tokensIn * rates.input / 1_000_000 + tokensOut * rates.output / 1_000_000) * 0.92;
}

const estadoLocalLabels: Record<string, string> = {
  disponible: "Disponible", en_negociacion: "Negociación", ocupado: "Ocupado", reforma: "Reforma",
};
const estadoMatchLabels: Record<string, string> = {
  pendiente: "Pendiente", sugerido: "Sugerido", contactado: "Contactado",
  aprobado: "Aprobado", descartado: "Descartado", exito: "Éxito",
};

const notifTypeIcons: Record<string, string> = {
  match_update: "🔄",
  match_created: "✨",
  info: "ℹ️",
};

interface Stats {
  proyectosActivos: number;
  totalOperadores: number;
  matchesPendientes: number;
  costeIAMes: number;
  totalLocales: number;
  latenciaMedia: number;
}

interface NotifRow {
  id: string;
  title: string;
  description: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [localEstadoDist, setLocalEstadoDist] = useState<any[]>([]);
  const [matchEstadoDist, setMatchEstadoDist] = useState<any[]>([]);
  const [matchScoreDist, setMatchScoreDist] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        proyectosRes, operadoresRes, matchesPendRes, audMesRes,
        localesCountRes, audLatRes, recentMatchesRes, actividadRes,
        localesAllRes, matchesAllRes, notifsRes,
      ] = await Promise.all([
        supabase.from("proyectos").select("id", { count: "exact", head: true }).in("estado", ["activo", "en_negociacion"]),
        supabase.from("operadores").select("id", { count: "exact", head: true }),
        supabase.from("matches").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
        supabase.from("auditoria_ia").select("tokens_entrada, tokens_salida, modelo").gte("created_at", startOfMonth.toISOString()).limit(500),
        supabase.from("locales").select("id", { count: "exact", head: true }),
        supabase.from("auditoria_ia").select("latencia_ms").order("created_at", { ascending: false }).limit(50),
        supabase.from("matches").select("id, score, estado, explicacion, created_at, locales(nombre), operadores(nombre)").order("created_at", { ascending: false }).limit(8),
        supabase.from("actividad_proyecto").select("id, descripcion, tipo, created_at, proyectos(nombre)").order("created_at", { ascending: false }).limit(10),
        supabase.from("locales").select("estado").limit(500),
        supabase.from("matches").select("estado, score").limit(1000),
        user ? supabase.from("notificaciones").select("id, title, description, type, read, link, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
      ]);

      const audMes = audMesRes.data || [];
      const costeIAMes = audMes.reduce((s, r) => s + estimateCostFromTokens(r.modelo || '', Number(r.tokens_entrada) || 0, Number(r.tokens_salida) || 0), 0);
      const latRows = audLatRes.data || [];
      const latenciaMedia = latRows.length > 0
        ? Math.round(latRows.reduce((s, r) => s + (Number(r.latencia_ms) || 0), 0) / latRows.length) : 0;

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

      setNotifications((notifsRes.data || []) as NotifRow[]);

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
  }, [user]);

  // Cards: 5 acentos iridiscentes (acc-1 → acc-5)
  const statCards = [
    { label: "Oportunidades", value: stats?.proyectosActivos, icon: FolderOpen, accent: 1 },
    { label: "Operadores",    value: stats?.totalOperadores,  icon: Users,      accent: 2 },
    { label: "Activos",       value: stats?.totalLocales,     icon: MapPin,     accent: 4 },
    { label: "Matches",       value: stats?.matchesPendientes, icon: Sparkles,  accent: 3 },
    { label: "Coste IA",      value: stats ? `${stats.costeIAMes.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : undefined, icon: DollarSign, accent: 5 },
    { label: "Latencia IA",   value: stats ? `${stats.latenciaMedia}ms` : undefined, icon: Clock, accent: 1 },
  ];

  const barData = recentMatches.map((m) => ({
    name: ((m.operadores as any)?.nombre || "Op").substring(0, 10),
    score: Number(m.score) || 0,
  }));

  const unreadCount = notifications.filter((n) => !n.read).length;

  const [profileName, setProfileName] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("perfiles")
      .select("nombre, apellidos")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const full = `${data.nombre || ""} ${data.apellidos || ""}`.trim();
          if (full) setProfileName(full);
        }
      });
  }, [user?.id]);

  const titleCase = (raw: string) =>
    raw
      .replace(/[._-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const userName = profileName
    ? titleCase(profileName)
    : titleCase(user?.email?.split("@")[0] || "Alberto");
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
  })();

  return (
    <div className="space-y-6 md:space-y-10">
      {/* Hero — eyebrow + display title */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.15em] text-white/45 font-semibold">AVA · DASHBOARD</p>
        <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-[-0.035em] leading-[1] text-white">
          {greeting}, <span className="text-iridescent">{userName}</span>
        </h1>
        <p className="text-sm md:text-base text-white/55 mt-3 max-w-xl">
          Tienes <span className="text-white font-medium num-display">{stats?.matchesPendientes ?? 0}</span> matches nuevos y <span className="text-white font-medium num-display">{stats?.proyectosActivos ?? 0}</span> oportunidades activas.
        </p>
      </div>

      {/* AVA pill highlight */}
      <Link to="/asistente" className="block glass glass-accent overflow-hidden relative group rounded-[20px]"
        style={{ "--acc-line": "var(--acc-2)" } as any}>
        <div className="relative p-5 md:p-6 flex items-center gap-4">
          <div
            className="h-12 w-12 md:h-14 md:w-14 rounded-2xl grid place-items-center text-white shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(var(--acc-1)), hsl(var(--acc-2)))", boxShadow: "0 8px 28px -8px hsl(var(--acc-2) / 0.7)" }}
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--acc-2))] font-semibold">AVA · Resumen del día</p>
            <p className="text-base md:text-lg font-semibold tracking-tight mt-1 text-white">Pregúntame lo que quieras sobre tu cartera</p>
            <p className="text-xs text-white/55 mt-0.5">Análisis, generación de informes, búsqueda y más.</p>
          </div>
          <ArrowRight className="h-5 w-5 text-white/40 group-hover:text-white transition-colors shrink-0" />
        </div>
      </Link>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button asChild className="text-white border-0 rounded-full h-11 px-5 w-full sm:w-auto sm:flex-none gradient-iridescent shadow-[0_6px_20px_-8px_hsl(var(--acc-2)/0.7)]">
          <Link to="/oportunidades"><Plus className="mr-1.5 h-4 w-4" /> Nueva oportunidad</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full h-11 px-5 w-full sm:w-auto sm:flex-none bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.08]">
          <Link to="/operadores"><Plus className="mr-1.5 h-4 w-4" /> Nuevo operador</Link>
        </Button>
      </div>

      {/* KPI cards — glass + accent line + icono coloreado */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="glass glass-accent p-4 flex flex-col gap-3 relative"
            style={{ "--acc-line": `var(--acc-${card.accent})` } as any}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-white/55 leading-tight uppercase tracking-[0.1em]">{card.label}</p>
              <div
                className="h-7 w-7 rounded-xl grid place-items-center"
                style={{
                  background: `hsl(var(--acc-${card.accent}) / 0.12)`,
                  color: `hsl(var(--acc-${card.accent}))`,
                }}
              >
                <card.icon className="h-3.5 w-3.5" />
              </div>
            </div>
            {loading
              ? <Skeleton className="h-7 w-16 bg-white/[0.06]" />
              : <p className="num-display text-2xl md:text-[28px] font-semibold text-white leading-none">{card.value}</p>}
          </div>
        ))}
      </div>

      {/* Notificaciones */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm md:text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Notificaciones
            {unreadCount > 0 && (
              <Badge className="text-[10px] px-1.5 py-0">{unreadCount} nuevas</Badge>
            )}
          </CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link to="/notificaciones">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32 w-full" /> : notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
              <p>Sin notificaciones recientes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 8).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-md border p-2.5 md:p-3 text-sm transition-colors ${!n.read ? "border-l-4 border-l-accent bg-accent/5" : ""}`}
                >
                  <span className="text-base md:text-lg mt-0.5">{notifTypeIcons[n.type] || "ℹ️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-xs md:text-sm">{n.title}</span>
                      {!n.read && <Badge className="text-[10px] px-1.5 py-0">Nueva</Badge>}
                    </div>
                    <p className="text-muted-foreground text-xs truncate">{n.description}</p>
                    <span className="text-[10px] md:text-xs text-muted-foreground">
                      {format(new Date(n.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                    </span>
                  </div>
                  {n.link && (
                    <Link
                      to={n.link}
                      className="text-xs text-primary hover:underline whitespace-nowrap mt-1"
                    >
                      Ver →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm md:text-base">Últimos Matches por Score</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[220px] md:h-[260px] w-full" /> : barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "12px" }} formatter={(v: number) => [`${v}%`, "Score"]} />
                  <Bar dataKey="score" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-10 text-center">
                <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">Aún no hay matches generados.</p>
                <Button asChild size="sm" variant="link" className="mt-2">
                  <Link to="/oportunidades">Ir a Oportunidades <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm md:text-base">Distribución de Scores</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[220px] md:h-[260px] w-full" /> : matchScoreDist.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={matchScoreDist} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "12px" }} formatter={(v: number) => [v, "Matches"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {matchScoreDist.map((_, i) => (
                      <Cell key={i} fill={["hsl(0,84%,60%)", "hsl(38,92%,50%)", "hsl(48,96%,53%)", "hsl(142,71%,45%)", "hsl(217,91%,60%)"][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="py-10 text-center text-muted-foreground text-sm">Sin matches</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm md:text-base">Activos por Estado</CardTitle></CardHeader>
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
            ) : <p className="text-sm text-muted-foreground">Sin activos</p>}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm md:text-base">Matches por Estado</CardTitle></CardHeader>
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm md:text-base">Últimos Matches</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/activos">Ver todos <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40 w-full" /> : recentMatches.length > 0 ? (
              <div className="space-y-2">
                {recentMatches.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border p-2.5 text-sm gap-1.5 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-xs md:text-sm">{(m.locales as any)?.nombre} ↔ {(m.operadores as any)?.nombre}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{m.explicacion?.substring(0, 80)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <Badge className="bg-accent/10 text-accent text-[10px]">{m.score}%</Badge>
                      <Badge variant="secondary" className="capitalize text-[10px]">{m.estado}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="py-6 text-center text-muted-foreground text-sm">Sin matches recientes.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" /> Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40 w-full" /> : recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((a) => (
                  <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border p-2.5 text-sm gap-1.5 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-xs md:text-sm">{a.descripcion}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{(a.proyectos as any)?.nombre || "—"}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{a.tipo}</Badge>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(a.created_at).toLocaleDateString("es-ES")}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">Sin actividad reciente.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
