import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Loader2, RefreshCw, MessageSquare, ShieldCheck, AlertTriangle, Eye, Zap, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Pattern {
  title: string;
  confidence: number;
  description: string;
  sources: string[];
  contrary_evidence?: string;
  layer: number;
}

interface PatternResult {
  verdict?: string;
  win_rate?: number;
  hypothesis_count?: number;
  patterns: Pattern[];
}

const LAYER_CONFIG: Record<number, { label: string; icon: React.ElementType; color: string }> = {
  1: { label: "Capa 1 — Evidentes", icon: Eye, color: "bg-chart-1" },
  2: { label: "Capa 2 — Analytics Avanzado", icon: Zap, color: "bg-chart-2" },
  3: { label: "Capa 3 — Señales Débiles", icon: AlertTriangle, color: "bg-chart-3" },
  4: { label: "Capa 4 — Inteligencia Lateral", icon: Brain, color: "bg-chart-4" },
  5: { label: "Capa 5 — Externos", icon: Globe, color: "bg-chart-5" },
};

function parsePatterns(answer: string): PatternResult {
  const patterns: Pattern[] = [];
  let verdict = "";
  let win_rate: number | undefined;
  let hypothesis_count: number | undefined;

  // Try to extract structured data from the answer
  const lines = answer.split("\n");
  let currentLayer = 1;
  let currentPattern: Partial<Pattern> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect verdict
    if (trimmed.toLowerCase().includes("veredicto") || trimmed.toLowerCase().includes("verdict")) {
      verdict = trimmed.replace(/^[#*\-\s]*(?:veredicto|verdict)[:\s]*/i, "").trim();
      continue;
    }

    // Detect win rate
    const wrMatch = trimmed.match(/win\s*rate[:\s]*(\d+(?:\.\d+)?)\s*%?/i) || trimmed.match(/tasa.*(?:éxito|acierto)[:\s]*(\d+(?:\.\d+)?)\s*%?/i);
    if (wrMatch) {
      win_rate = parseFloat(wrMatch[1]);
      continue;
    }

    // Detect layer headers
    const layerMatch = trimmed.match(/capa\s*(\d)/i) || trimmed.match(/layer\s*(\d)/i);
    if (layerMatch) {
      currentLayer = parseInt(layerMatch[1], 10);
      continue;
    }

    // Detect pattern titles (bold or heading)
    const titleMatch = trimmed.match(/^(?:#{1,3}\s+|\*\*|-)?\s*(.{10,80})(?:\*\*)?$/);
    if (titleMatch && !trimmed.startsWith("Fuente") && !trimmed.startsWith("Confianza") && !trimmed.startsWith("Evidencia")) {
      if (currentPattern?.title) {
        patterns.push({
          title: currentPattern.title,
          confidence: currentPattern.confidence || 70,
          description: currentPattern.description || "",
          sources: currentPattern.sources || [],
          contrary_evidence: currentPattern.contrary_evidence,
          layer: currentPattern.layer || currentLayer,
        });
      }
      currentPattern = { title: titleMatch[1].replace(/\*\*/g, "").trim(), layer: currentLayer, sources: [] };
      continue;
    }

    if (currentPattern) {
      const confMatch = trimmed.match(/confianza[:\s]*(\d+)/i) || trimmed.match(/confidence[:\s]*(\d+)/i);
      if (confMatch) {
        currentPattern.confidence = parseInt(confMatch[1], 10);
        continue;
      }
      const srcMatch = trimmed.match(/fuente[s]?[:\s]*(.*)/i) || trimmed.match(/source[s]?[:\s]*(.*)/i);
      if (srcMatch) {
        currentPattern.sources = srcMatch[1].split(",").map(s => s.trim()).filter(Boolean);
        continue;
      }
      const ceMatch = trimmed.match(/evidencia contraria[:\s]*(.*)/i) || trimmed.match(/contrary[:\s]*(.*)/i);
      if (ceMatch) {
        currentPattern.contrary_evidence = ceMatch[1].trim();
        continue;
      }
      if (trimmed.length > 20) {
        currentPattern.description = (currentPattern.description || "") + " " + trimmed;
      }
    }
  }

  // Push last
  if (currentPattern?.title) {
    patterns.push({
      title: currentPattern.title,
      confidence: currentPattern.confidence || 70,
      description: (currentPattern.description || "").trim(),
      sources: currentPattern.sources || [],
      contrary_evidence: currentPattern.contrary_evidence,
      layer: currentPattern.layer || currentLayer,
    });
  }

  hypothesis_count = patterns.length || undefined;

  // If no patterns parsed, create one from the full answer
  if (patterns.length === 0 && answer.trim()) {
    patterns.push({
      title: "Análisis general de patrones",
      confidence: 75,
      description: answer.slice(0, 500),
      sources: ["Expert Forge MoE"],
      layer: 1,
    });
    verdict = verdict || "Análisis completado";
    hypothesis_count = 1;
  }

  return { verdict, win_rate, hypothesis_count, patterns };
}

export default function Patrones() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PatternResult | null>(null);
  const [rawAnswer, setRawAnswer] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Load from DB on mount
  useState(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("ai_agent_tasks")
          .select("resultado")
          .eq("agente_tipo", "patrones_cache")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (data?.resultado) {
          const cached = data.resultado as any;
          if (cached.parsed) setResult(cached.parsed);
          if (cached.raw) setRawAnswer(cached.raw);
        }
      } catch {}
    })();
  });

  const saveToDb = async (parsed: PatternResult, raw: string) => {
    try {
      await supabase.from("ai_agent_tasks").upsert({
        agente_tipo: "patrones_cache",
        estado: "completado",
        resultado: { parsed, raw } as any,
        creado_por: user?.id || null,
      }, { onConflict: "agente_tipo" });
    } catch {}
  };

  const fetchPatterns = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ava-orchestrator", {
        body: {
          message: "Dame los patrones detectados del último análisis. Organízalos por capas (Capa 1: Evidentes, Capa 2: Analytics Avanzado, Capa 3: Señales Débiles, Capa 4: Inteligencia Lateral, Capa 5: Externos). Para cada patrón indica: título, porcentaje de confianza, descripción, fuentes, y evidencia contraria si la hay. Incluye un veredicto general, win rate del backtest, y número total de hipótesis.",
          history: [],
        },
      });
      if (error) throw new Error(error.message);
      const answer = data?.answer || data?.error || "Sin respuesta";
      setRawAnswer(answer);
      const parsed = parsePatterns(answer);
      setResult(parsed);
      await saveToDb(parsed, answer);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openAvaWithPatterns = () => {
    // Store a pre-loaded prompt in sessionStorage for the chat
    sessionStorage.setItem("ava-preload-prompt", "Analiza los patrones detectados en profundidad. ¿Cuáles tienen mayor probabilidad de éxito y por qué?");
    navigate("/asistente");
  };

  const confidenceColor = (c: number) => {
    if (c >= 80) return "text-chart-2";
    if (c >= 60) return "text-chart-3";
    return "text-destructive";
  };

  const groupedByLayer = result
    ? Object.entries(LAYER_CONFIG).map(([layerNum, config]) => ({
        layer: parseInt(layerNum, 10),
        config,
        patterns: result.patterns.filter(p => p.layer === parseInt(layerNum, 10)),
      })).filter(g => g.patterns.length > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Patrones de Inteligencia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Patrones detectados por los especialistas de Expert Forge, organizados por capas de profundidad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchPatterns} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {result ? "Actualizar" : "Cargar patrones"}
          </Button>
          <Button variant="outline" onClick={openAvaWithPatterns}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Consultar AVA
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary KPIs */}
      {result && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Veredicto</p>
                  <p className="text-sm font-semibold">{result.verdict || "Sin veredicto"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-chart-2" />
                <div>
                  <p className="text-xs text-muted-foreground">Win Rate Backtest</p>
                  <p className="text-2xl font-bold">{result.win_rate != null ? `${result.win_rate}%` : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Brain className="h-8 w-8 text-chart-4" />
                <div>
                  <p className="text-xs text-muted-foreground">Hipótesis detectadas</p>
                  <p className="text-2xl font-bold">{result.hypothesis_count ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Patterns by layer */}
      {groupedByLayer.map(({ layer, config, patterns }) => {
        const LayerIcon = config.icon;
        return (
          <div key={layer} className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold ${config.color}`}>
                {layer}
              </span>
              <LayerIcon className="h-4 w-4" />
              {config.label}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {patterns.map((p, idx) => (
                <Card key={idx} className="border-l-4" style={{ borderLeftColor: `hsl(var(--chart-${layer}))` }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="truncate">{p.title}</span>
                      <span className={`text-xs font-bold ${confidenceColor(p.confidence)}`}>
                        {p.confidence}%
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {p.description.slice(0, 200)}{p.description.length > 200 ? "…" : ""}
                    </p>
                    {p.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.sources.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    )}
                    {p.contrary_evidence && (
                      <div className="rounded bg-destructive/10 p-2 text-[10px] text-destructive">
                        <AlertTriangle className="inline h-3 w-3 mr-1" />
                        {p.contrary_evidence}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {!loading && !result && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Brain className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg">Sin patrones cargados</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Pulsa "Cargar patrones" para consultar a los especialistas de Expert Forge y obtener los patrones detectados del último análisis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
