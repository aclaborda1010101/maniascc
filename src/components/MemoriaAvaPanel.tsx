import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, EyeOff, MessageSquare, RefreshCw, TrendingDown, TrendingUp, Sparkles } from "lucide-react";

interface LearnedPattern {
  id: string;
  patron_tipo: string;
  patron_key: string;
  patron_descripcion: string | null;
  tasa_exito: number | null;
  num_observaciones: number | null;
  score_ajuste: number | null;
  confianza: number | null;
  activo: boolean | null;
  updated_at: string | null;
}

interface Telemetria {
  feedbackUlt30d: number;
  patronesNuevos30d: number;
  patronesCambioSigno30d: number;
  totalActivos: number;
}

const TIPOS_AVA = ["ava_correction", "ava_topic", "ava_tool_combo"];

function fmtFecha(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function ConfChip({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  const tone = pct >= 75 ? "acc-4" : pct >= 50 ? "acc-5" : "acc-3";
  return (
    <span className="chip num-display" style={{ borderColor: `hsl(var(--${tone}) / 0.35)`, color: `hsl(var(--${tone}))` }}>
      <span className="chip-dot" style={{ background: `hsl(var(--${tone}))` }} /> {pct}%
    </span>
  );
}

function ExitoChip({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  const Icon = pct >= 60 ? TrendingUp : pct <= 40 ? TrendingDown : Sparkles;
  const tone = pct >= 60 ? "acc-4" : pct <= 40 ? "destructive" : "acc-5";
  return (
    <span className="inline-flex items-center gap-1 text-xs num-display" style={{ color: `hsl(var(--${tone}))` }}>
      <Icon className="h-3 w-3" /> {pct}%
    </span>
  );
}

export function MemoriaAvaPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [patterns, setPatterns] = useState<LearnedPattern[]>([]);
  const [telemetria, setTelemetria] = useState<Telemetria | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [minConfianza, setMinConfianza] = useState<number>(0);
  const [busqueda, setBusqueda] = useState("");

  const cargar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_learned_patterns")
        .select("id, patron_tipo, patron_key, patron_descripcion, tasa_exito, num_observaciones, score_ajuste, confianza, activo, updated_at")
        .in("patron_tipo", TIPOS_AVA)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setPatterns((data || []) as LearnedPattern[]);

      // Telemetría: últimos 30 días
      const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [{ count: feedbackCount }, { count: patronesNuevos }, { count: totalActivos }] = await Promise.all([
        supabase.from("ai_feedback").select("id", { count: "exact", head: true }).gte("created_at", desde),
        supabase.from("ai_learned_patterns").select("id", { count: "exact", head: true }).gte("created_at", desde),
        supabase.from("ai_learned_patterns").select("id", { count: "exact", head: true }).eq("activo", true),
      ]);

      // Patrones que han cambiado de signo: aproximación = activos con pocas observaciones y tasa extrema actualizados recientemente
      const cambioSigno = (data || []).filter((p) => {
        if (!p.tasa_exito || !p.updated_at) return false;
        const t = new Date(p.updated_at).getTime();
        return t > Date.now() - 30 * 24 * 60 * 60 * 1000 && (p.tasa_exito < 0.3 || p.tasa_exito > 0.7);
      }).length;

      setTelemetria({
        feedbackUlt30d: feedbackCount || 0,
        patronesNuevos30d: patronesNuevos || 0,
        patronesCambioSigno30d: cambioSigno,
        totalActivos: totalActivos || 0,
      });
    } catch (e: any) {
      toast({ title: "Error cargando memoria", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const desactivar = async (id: string) => {
    const prev = patterns;
    setPatterns((p) => p.map((x) => (x.id === id ? { ...x, activo: false } : x)));
    const { error } = await supabase.from("ai_learned_patterns").update({ activo: false }).eq("id", id);
    if (error) {
      setPatterns(prev);
      toast({ title: "No se pudo desactivar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lección desactivada", description: "AVA dejará de aplicarla." });
    }
  };

  const reactivar = async (id: string) => {
    const prev = patterns;
    setPatterns((p) => p.map((x) => (x.id === id ? { ...x, activo: true } : x)));
    const { error } = await supabase.from("ai_learned_patterns").update({ activo: true }).eq("id", id);
    if (error) {
      setPatterns(prev);
      toast({ title: "No se pudo reactivar", description: error.message, variant: "destructive" });
    }
  };

  const filtradas = useMemo(() => {
    return patterns.filter((p) => {
      if (filtroTipo !== "all" && p.patron_tipo !== filtroTipo) return false;
      if ((p.confianza ?? 0) < minConfianza / 100) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const hay = `${p.patron_descripcion || ""} ${p.patron_key}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [patterns, filtroTipo, minConfianza, busqueda]);

  const correcciones = filtradas.filter((p) => p.patron_tipo === "ava_correction");
  const topicos = filtradas.filter((p) => p.patron_tipo === "ava_topic");
  const combos = filtradas.filter((p) => p.patron_tipo === "ava_tool_combo");

  return (
    <div className="space-y-5">
      {/* Telemetría */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TelemetriaCard label="Feedbacks (30d)" value={telemetria?.feedbackUlt30d} accent="acc-1" loading={loading} />
        <TelemetriaCard label="Lecciones nuevas (30d)" value={telemetria?.patronesNuevos30d} accent="acc-2" loading={loading} />
        <TelemetriaCard label="Señales fuertes (30d)" value={telemetria?.patronesCambioSigno30d} accent="acc-4" loading={loading} hint="patrones con tasa extrema" />
        <TelemetriaCard label="Activas en total" value={telemetria?.totalActivos} accent="acc-5" loading={loading} />
      </div>

      {/* Filtros */}
      <div className="glass p-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Buscar en descripción o clave…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-8 text-xs bg-transparent border-border/40"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="h-8 text-xs w-full md:w-44 bg-transparent border-border/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="ava_correction">Correcciones</SelectItem>
            <SelectItem value="ava_topic">Tópicos</SelectItem>
            <SelectItem value="ava_tool_combo">Combos de tools</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(minConfianza)} onValueChange={(v) => setMinConfianza(Number(v))}>
          <SelectTrigger className="h-8 text-xs w-full md:w-44 bg-transparent border-border/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Confianza ≥ 0%</SelectItem>
            <SelectItem value="40">Confianza ≥ 40%</SelectItem>
            <SelectItem value="60">Confianza ≥ 60%</SelectItem>
            <SelectItem value="80">Confianza ≥ 80%</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="rounded-2xl border-border/40" onClick={cargar} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refrescar
        </Button>
      </div>

      {/* Tablas */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <>
          <PatternsTable
            title="Correcciones aprendidas"
            icon={<MessageSquare className="h-4 w-4" />}
            rows={correcciones}
            onDesactivar={desactivar}
            onReactivar={reactivar}
            emptyHint="Aún no hay correcciones acumuladas. Vota 👎 + corrección en el chat de AVA."
          />
          <PatternsTable
            title="Tópicos aprendidos"
            icon={<Brain className="h-4 w-4" />}
            rows={topicos}
            onDesactivar={desactivar}
            onReactivar={reactivar}
            emptyHint="AVA todavía no ha consolidado tópicos con votos."
          />
          {combos.length > 0 && (
            <PatternsTable
              title="Combos de herramientas"
              icon={<Sparkles className="h-4 w-4" />}
              rows={combos}
              onDesactivar={desactivar}
              onReactivar={reactivar}
              emptyHint=""
            />
          )}
        </>
      )}
    </div>
  );
}

function TelemetriaCard({ label, value, accent, loading, hint }: { label: string; value?: number; accent: string; loading: boolean; hint?: string }) {
  return (
    <div className="glass glass-accent p-3" style={{ ["--acc-line" as any]: `var(--${accent})` }}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-14 mt-1" />
      ) : (
        <p className="font-display font-semibold text-2xl num-display mt-0.5">{value ?? 0}</p>
      )}
      {hint && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{hint}</p>}
    </div>
  );
}

function PatternsTable({
  title,
  icon,
  rows,
  onDesactivar,
  onReactivar,
  emptyHint,
}: {
  title: string;
  icon: React.ReactNode;
  rows: LearnedPattern[];
  onDesactivar: (id: string) => void;
  onReactivar: (id: string) => void;
  emptyHint: string;
}) {
  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          {icon} {title}
        </h3>
        <span className="chip">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">{emptyHint}</p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-widest h-8">Descripción / clave</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest h-8 w-20 text-center">Confianza</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest h-8 w-20 text-center">Éxito</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest h-8 w-16 text-center">N</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest h-8 w-24">Actualizado</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest h-8 w-24 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} className={`border-border/30 ${p.activo ? "" : "opacity-50"}`}>
                  <TableCell className="py-2">
                    <p className="text-sm leading-snug line-clamp-2">{p.patron_descripcion || <em className="text-muted-foreground">sin descripción</em>}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-md">{p.patron_key}</p>
                  </TableCell>
                  <TableCell className="text-center py-2"><ConfChip value={p.confianza} /></TableCell>
                  <TableCell className="text-center py-2"><ExitoChip value={p.tasa_exito} /></TableCell>
                  <TableCell className="text-center py-2 text-xs num-display">{p.num_observaciones ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground py-2">{fmtFecha(p.updated_at)}</TableCell>
                  <TableCell className="text-right py-2">
                    {p.activo ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onDesactivar(p.id)}>
                        <EyeOff className="h-3 w-3 mr-1" /> Desactivar
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onReactivar(p.id)}>
                        Reactivar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
