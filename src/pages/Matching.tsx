import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Sparkles, MapPin, Brain, X, Clock, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ScoreRing } from "@/components/ScoreRing";
import { cn } from "@/lib/utils";
import {
  recordMatchSelection,
  recordMatchRejection,
} from "@/services/feedbackService";

// Razones placeholder derivadas determinísticamente del score (hasta tener desglose real)
function buildReasons(score: number) {
  const seed = (n: number) => Math.max(40, Math.min(100, score + n));
  return [
    { label: "Tráfico peatonal", value: seed(4) },
    { label: "Zona AAA", value: seed(2) },
    { label: "Encaje sectorial", value: seed(-2) },
    { label: "Ajuste presupuesto", value: seed(-5) },
    { label: "Histórico operador", value: seed(-8) },
  ];
}

export default function Matching() {
  const { localId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [local, setLocal] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activos, setActivos] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [acting, setActing] = useState(false);

  const fetchData = async () => {
    if (!localId) {
      const { data } = await supabase
        .from("locales")
        .select("id, nombre, ciudad, direccion")
        .order("created_at", { ascending: false })
        .limit(50);
      setActivos(data || []);
      setLoading(false);
      return;
    }
    const [localRes, matchesRes] = await Promise.all([
      supabase.from("locales").select("*").eq("id", localId).single(),
      supabase
        .from("matches")
        .select("*, operadores(nombre, sector)")
        .eq("local_id", localId)
        .order("score", { ascending: false }),
    ]);
    setLocal(localRes.data);
    setMatches(matchesRes.data || []);
    setCurrentIdx(0);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [localId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-match", {
        body: { local_id: localId },
      });
      if (error) throw error;
      toast({
        title: "Matches generados",
        description: `${data?.matches?.length || 0} operadores analizados`,
      });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Error generando matches", description: e.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  const current = matches[currentIdx];
  const reasons = useMemo(() => (current ? buildReasons(current.score) : []), [current]);

  const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIdx((i) => Math.min(matches.length - 1, i + 1));

  const handleAction = async (kind: "approve" | "defer" | "reject") => {
    if (!current) return;
    setActing(true);
    const map = {
      approve: { estado: "contactado", fb: "positivo" },
      defer: { estado: "pendiente", fb: "neutro" },
      reject: { estado: "descartado", fb: "negativo" },
    } as const;
    const m = map[kind];
    const { error } = await supabase
      .from("matches")
      .update({ estado: m.estado as any, feedback_usuario: m.fb })
      .eq("id", current.id);
    if (!error) {
      if (kind === "approve") {
        recordMatchSelection(current.id, "", current.operador_id, currentIdx);
      } else if (kind === "reject") {
        recordMatchRejection(current.id);
      }
      toast({
        title:
          kind === "approve" ? "Match aprobado" : kind === "defer" ? "Match aplazado" : "Match descartado",
      });
      // avanza al siguiente
      if (currentIdx < matches.length - 1) goNext();
      await fetchData();
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setActing(false);
  };

  // ───── Loading ─────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  // ───── List view (no localId) ─────
  if (!local && !localId) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Matching IA</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">Elige un activo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecciona un activo para ver y generar matches con operadores compatibles.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {activos.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/matching/${a.id}`)}
              className="card-premium p-4 text-left hover:border-accent/40 transition-colors"
            >
              <p className="font-semibold tracking-tight truncate">{a.nombre}</p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" /> {a.direccion}, {a.ciudad}
              </p>
            </button>
          ))}
          {activos.length === 0 && (
            <div className="card-premium p-12 text-center col-span-full">
              <p className="text-sm text-muted-foreground">No hay activos disponibles aún.</p>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (!local) return <p className="text-muted-foreground">Local no encontrado.</p>;

  // ───── Detail view (localId) ─────
  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/locales/${localId}`)} className="rounded-2xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Matching IA</p>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{local.nombre}</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3" /> {local.direccion}, {local.ciudad}
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-2xl ava-gradient text-white border-0 hover:opacity-95"
          size="sm"
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          {generating ? "Analizando..." : "Generar"}
        </Button>
      </div>

      {/* Generating */}
      {generating && (
        <div className="card-premium p-12 text-center">
          <Brain className="mx-auto mb-3 h-10 w-10 text-accent animate-pulse" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Analizando compatibilidad con IA…
          </p>
        </div>
      )}

      {/* Empty */}
      {!generating && matches.length === 0 && (
        <div className="card-premium p-12 text-center">
          <Brain className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold mb-1">Sin matches todavía</h3>
          <p className="text-muted-foreground text-sm">
            Pulsa "Generar" para analizar operadores compatibles con este activo.
          </p>
        </div>
      )}

      {/* Match individual con score grande */}
      {!generating && current && (
        <>
          {/* Indicador 1/N */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={goPrev}
              disabled={currentIdx === 0}
              className="rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
              {currentIdx + 1} / {matches.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              disabled={currentIdx === matches.length - 1}
              className="rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Card central */}
          <div className="card-premium p-6 md:p-10">
            <div className="flex flex-col items-center text-center">
              <ScoreRing value={current.score} size={180} colorScheme="match" label="MATCH" />
              <h2 className="mt-5 text-2xl md:text-3xl font-bold tracking-tight">
                {current.operadores?.nombre || "Operador"}
              </h2>
              {current.operadores?.sector && (
                <span className="mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize bg-accent/15 text-accent border border-accent/30">
                  {current.operadores.sector}
                </span>
              )}
              {current.explicacion && (
                <p className="mt-4 text-sm text-muted-foreground max-w-xl leading-relaxed">
                  {current.explicacion}
                </p>
              )}
            </div>

            {/* Razones */}
            <div className="mt-8 space-y-3 max-w-xl mx-auto">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                Razones del score
              </p>
              {reasons.map((r) => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs md:text-sm font-medium">{r.label}</span>
                    <span className="text-xs md:text-sm font-bold tabular-nums text-foreground">
                      {r.value}
                    </span>
                  </div>
                  <Progress
                    value={r.value}
                    className="h-1.5 bg-secondary [&>div]:ava-gradient"
                  />
                </div>
              ))}
            </div>

            {/* 3 botones circulares */}
            <div className="mt-10 flex items-center justify-center gap-6 md:gap-10">
              <CircleAction
                color="destructive"
                onClick={() => handleAction("reject")}
                disabled={acting}
                ariaLabel="Descartar"
              >
                <X className="h-7 w-7" />
              </CircleAction>
              <CircleAction
                color="warning"
                onClick={() => handleAction("defer")}
                disabled={acting}
                ariaLabel="Aplazar"
              >
                <Clock className="h-7 w-7" />
              </CircleAction>
              <CircleAction
                color="success"
                onClick={() => handleAction("approve")}
                disabled={acting}
                ariaLabel="Aprobar"
              >
                <Check className="h-7 w-7" />
              </CircleAction>
            </div>

            {current.estado && current.estado !== "pendiente" && current.estado !== "sugerido" && (
              <p className="mt-4 text-center text-xs text-muted-foreground capitalize">
                Estado actual: {current.estado.replace("_", " ")}
              </p>
            )}
          </div>

          {/* Mini lista del resto — vertical en móvil, horizontal en desktop */}
          {matches.length > 1 && (
            <div className="card-premium p-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3 px-1">
                Cola
              </p>
              <div className="flex flex-col gap-2 md:flex-row md:overflow-x-auto md:no-scrollbar">
                {matches.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setCurrentIdx(i)}
                    className={cn(
                      "shrink-0 rounded-2xl border px-3 py-2 text-left w-full md:w-auto md:min-w-[140px] transition-colors",
                      i === currentIdx
                        ? "border-accent bg-accent/10"
                        : "border-border/60 hover:border-accent/40 bg-card-elevated"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">
                        {m.operadores?.nombre || "Operador"}
                      </span>
                      <span className="text-xs font-bold tabular-nums text-accent">{m.score}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CircleAction({
  children, onClick, disabled, color, ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color: "success" | "destructive" | "warning";
  ariaLabel: string;
}) {
  const palette = {
    success: "bg-[hsl(145_80%_55%_/_0.12)] text-[hsl(145_80%_50%)] border-[hsl(145_80%_55%_/_0.35)] hover:bg-[hsl(145_80%_55%_/_0.2)]",
    warning: "bg-[hsl(38_92%_55%_/_0.12)] text-[hsl(38_92%_55%)] border-[hsl(38_92%_55%_/_0.35)] hover:bg-[hsl(38_92%_55%_/_0.2)]",
    destructive: "bg-[hsl(0_84%_60%_/_0.12)] text-[hsl(0_84%_60%)] border-[hsl(0_84%_60%_/_0.35)] hover:bg-[hsl(0_84%_60%_/_0.2)]",
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "h-16 w-16 md:h-20 md:w-20 rounded-full border grid place-items-center transition-all active:scale-90 disabled:opacity-50",
        palette[color]
      )}
    >
      {children}
    </button>
  );
}
