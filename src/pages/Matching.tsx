import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, MapPin, Brain, Clock, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { MatchCard } from "@/components/MatchCard";

export default function Matching() {
  const { localId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [local, setLocal] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<{ latency_ms?: number; modelo?: string; ai_enhanced?: boolean } | null>(null);
  const [activos, setActivos] = useState<any[]>([]);

  const fetchData = async () => {
    if (!localId) {
      const { data } = await supabase.from("locales").select("id, nombre, ciudad, direccion").order("created_at", { ascending: false }).limit(50);
      setActivos(data || []);
      setLoading(false);
      return;
    }
    const [localRes, matchesRes] = await Promise.all([
      supabase.from("locales").select("*").eq("id", localId).single(),
      supabase.from("matches").select("*, operadores(nombre)").eq("local_id", localId).order("score", { ascending: false }),
    ]);
    setLocal(localRes.data);
    setMatches(matchesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [localId]);


  const handleGenerate = async () => {
    setGenerating(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-match", {
        body: { local_id: localId },
      });
      if (error) throw error;
      setLastResult({
        latency_ms: data?.latency_ms,
        modelo: data?.modelo,
        ai_enhanced: data?.ai_enhanced,
      });
      toast({
        title: "Matches generados",
        description: `${data?.matches?.length || 0} operadores analizados${data?.ai_enhanced ? " con IA" : ""}`,
      });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Error generando matches", description: e.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    );
  }

  if (!local) return <p className="text-muted-foreground">Local no encontrado.</p>;

  const pendientes = matches.filter(m => m.estado === "pendiente" || m.estado === "sugerido").length;
  const aprobados = matches.filter(m => m.estado === "contactado" || m.estado === "aprobado" || m.estado === "exito").length;
  const descartados = matches.filter(m => m.estado === "descartado").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/locales/${localId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Matching IA</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-4 w-4" /> {local.nombre} — {local.direccion}, {local.ciudad}
          </p>
        </div>
      </div>

      {/* Local summary + generate button */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <div><span className="text-muted-foreground">Superficie:</span> <strong>{Number(local.superficie_m2).toLocaleString("es-ES")} m²</strong></div>
              <div><span className="text-muted-foreground">Renta:</span> <strong>{Number(local.precio_renta).toLocaleString("es-ES")} €/mes</strong></div>
              <div><span className="text-muted-foreground">Estado:</span> <Badge variant="secondary" className="ml-1 capitalize">{local.estado?.replace("_", " ")}</Badge></div>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {generating ? "Analizando con IA..." : "Generar Matches IA"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats bar */}
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{matches.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-chart-3/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-chart-3" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendientes</p>
                <p className="text-lg font-bold">{pendientes}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-chart-2/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aprobados</p>
                <p className="text-lg font-bold">{aprobados}</p>
              </div>
            </CardContent>
          </Card>
          {lastResult && (
            <Card className="flex-1 min-w-[140px]">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Modelo</p>
                  <p className="text-sm font-semibold truncate">{lastResult.ai_enhanced ? "IA ✓" : "Reglas"}</p>
                  {lastResult.latency_ms && <p className="text-xs text-muted-foreground">{lastResult.latency_ms}ms</p>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 py-4">
            <Brain className="h-6 w-6 text-accent animate-pulse" />
            <p className="text-muted-foreground animate-pulse">
              Analizando compatibilidad con IA y buscando operadores óptimos...
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {/* Match cards */}
      {!generating && matches.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {matches.map((m, i) => (
            <MatchCard key={m.id} match={m} index={i} onUpdate={fetchData} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!generating && matches.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold mb-1">Sin matches todavía</h3>
            <p className="text-muted-foreground mb-4">
              Pulsa "Generar Matches IA" para analizar operadores compatibles con este local.
            </p>
            <p className="text-xs text-muted-foreground">
              El sistema evaluará superficie, presupuesto y sector usando reglas de negocio + IA generativa.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
