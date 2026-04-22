import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, Eye, Check, X, TrendingUp, AlertTriangle, Lightbulb, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { cn } from "@/lib/utils";

interface Props {
  proyectoId: string;
}

const TIPO_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  opportunity: { icon: Lightbulb, color: "text-emerald-500", label: "Oportunidad" },
  risk: { icon: AlertTriangle, color: "text-red-500", label: "Riesgo" },
  recommendation: { icon: TrendingUp, color: "text-blue-500", label: "Recomendación" },
  anomaly: { icon: Activity, color: "text-orange-500", label: "Anomalía" },
  trend: { icon: TrendingUp, color: "text-purple-500", label: "Tendencia" },
};

const SEVERIDAD_BADGE: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  opportunity: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

export function ProyectoInsights({ proyectoId }: Props) {
  const { toast } = useToast();
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [patterns, setPatterns] = useState<any[]>([]);

  const fetchInsights = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ai_insights" as any)
      .select("*")
      .eq("proyecto_id", proyectoId)
      .order("created_at", { ascending: false })
      .limit(20);
    setInsights((data || []) as any[]);
    setLoading(false);
  };

  const fetchPatterns = async () => {
    const { data } = await supabase
      .from("ai_learned_patterns" as any)
      .select("*")
      .eq("activo", true)
      .gte("num_observaciones", 3)
      .order("confianza", { ascending: false })
      .limit(10);
    setPatterns((data || []) as any[]);
  };

  useEffect(() => {
    fetchInsights();
    fetchPatterns();
  }, [proyectoId]);

  const handleGenerateInsights = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("ai-background-agent", {
      body: { proyecto_id: proyectoId, agent_type: "opportunity_detector" },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${data.insights_count} insights generados`, description: `${data.latency_ms}ms` });
      fetchInsights();
    }
    setGenerating(false);
  };

  const updateInsightEstado = async (insightId: string, estado: string) => {
    await supabase.from("ai_insights" as any).update({ 
      estado, 
      visto_en: estado === "visto" ? new Date().toISOString() : undefined 
    } as any).eq("id", insightId);
    fetchInsights();
  };

  const nuevos = insights.filter(i => i.estado === "nuevo").length;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Insights Panel */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" /> Insights IA
              {nuevos > 0 && <Badge className="bg-primary/10 text-primary text-xs">{nuevos} nuevos</Badge>}
            </CardTitle>
            <Button onClick={handleGenerateInsights} disabled={generating} size="sm" className="bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Brain className="h-3.5 w-3.5 mr-1" />}
              Analizar proyecto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}</div>
          ) : insights.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay insights aún. Haz clic en "Analizar proyecto" para que la IA detecte oportunidades y riesgos.
            </p>
          ) : (
            insights.map((insight) => {
              const config = TIPO_CONFIG[insight.tipo] || TIPO_CONFIG.recommendation;
              const Icon = config.icon;
              return (
                <div key={insight.id} className={cn(
                  "rounded-lg border p-3 space-y-2 transition-colors",
                  insight.estado === "nuevo" && "border-primary/30 bg-primary/5"
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-medium">{insight.titulo}</h4>
                          <Badge variant="outline" className={cn("text-[10px] h-4", SEVERIDAD_BADGE[insight.severidad])}>
                            {insight.severidad}
                          </Badge>
                          {insight.impacto_estimado && (
                            <Badge variant="outline" className="text-[10px] h-4">
                              Impacto {insight.impacto_estimado}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{insight.descripcion}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {insight.estado === "nuevo" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateInsightEstado(insight.id, "aceptado")} title="Aceptar">
                            <Check className="h-3 w-3 text-emerald-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateInsightEstado(insight.id, "descartado")} title="Descartar">
                            <X className="h-3 w-3 text-red-500" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateInsightEstado(insight.id, "visto")} title="Marcar visto">
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Acciones sugeridas */}
                  {insight.acciones_sugeridas?.length > 0 && (
                    <div className="pl-6">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Acciones sugeridas:</p>
                      <div className="space-y-1">
                        {(insight.acciones_sugeridas as any[]).slice(0, 3).map((a: any, i: number) => (
                          <div key={i} className="text-xs flex items-start gap-1">
                            <span className="text-primary mt-0.5">→</span>
                            <span>{a.accion}: {a.descripcion}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Confianza: {Math.round(insight.confianza * 100)}%
                    </span>
                    <FeedbackWidget entidadTipo="insight" entidadId={insight.id} compact />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Learned Patterns Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Patrones aprendidos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {patterns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              La IA aprenderá de tus decisiones. Da feedback en matches y documentos para mejorar las predicciones.
            </p>
          ) : (
            patterns.map((p) => (
              <div key={p.id} className="rounded-md border p-2 text-xs space-y-1">
                <p className="font-medium">{p.patron_descripcion}</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Ajuste: <span className={p.score_ajuste > 0 ? "text-emerald-500" : "text-red-500"}>
                    {p.score_ajuste > 0 ? "+" : ""}{p.score_ajuste}
                  </span></span>
                  <span>·</span>
                  <span>Éxito: {Math.round(p.tasa_exito * 100)}%</span>
                  <span>·</span>
                  <span>{p.num_observaciones} obs</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1">
                  <div className="bg-primary h-1 rounded-full" style={{ width: `${p.confianza * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
