import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Sparkles, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Stats {
  totalLocales: number;
  operadoresActivos: number;
  matchesExitosos: number;
  costeIA: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [localesRes, operadoresRes, matchesRes, auditoriaRes, recentRes] = await Promise.all([
        supabase.from("locales").select("id", { count: "exact", head: true }),
        supabase.from("operadores").select("id", { count: "exact", head: true }).eq("activo", true),
        supabase.from("matches").select("id", { count: "exact", head: true }).eq("estado", "aprobado"),
        supabase.from("auditoria_ia").select("coste_estimado"),
        supabase.from("matches").select("*, locales(nombre), operadores(nombre)").order("created_at", { ascending: false }).limit(5),
      ]);

      const costeTotal = (auditoriaRes.data || []).reduce((sum, r) => sum + (Number(r.coste_estimado) || 0), 0);

      setStats({
        totalLocales: localesRes.count || 0,
        operadoresActivos: operadoresRes.count || 0,
        matchesExitosos: matchesRes.count || 0,
        costeIA: costeTotal,
      });
      setRecentMatches(recentRes.data || []);
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-3xl font-bold">{card.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimos Matches</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
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
              <p className="py-8 text-center text-muted-foreground">
                Aún no hay matches generados. Crea locales y operadores para empezar.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentMatches.length > 0 ? (
              <div className="space-y-3">
                {recentMatches.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">{(m.locales as any)?.nombre}</p>
                      <p className="text-xs text-muted-foreground">↔ {(m.operadores as any)?.nombre}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                        {m.score}%
                      </span>
                      <span className={`text-xs capitalize ${m.estado === "aprobado" ? "text-chart-2" : m.estado === "descartado" ? "text-destructive" : "text-muted-foreground"}`}>
                        {m.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">Sin actividad reciente.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
