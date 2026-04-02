import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Brain, Loader2, RefreshCw, MessageSquare, ShieldCheck, AlertTriangle, Eye, Zap, Globe, ChevronRight } from "lucide-react";
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

const LAYER_CONFIG: Record<number, { label: string; description: string; icon: React.ElementType; color: string }> = {
  1: { label: "Evidentes", description: "Patrones claros y fácilmente observables en los datos", icon: Eye, color: "text-chart-1" },
  2: { label: "Analytics Avanzado", description: "Correlaciones detectadas mediante análisis profundo", icon: Zap, color: "text-chart-2" },
  3: { label: "Señales Débiles", description: "Indicios sutiles que podrían anticipar tendencias", icon: AlertTriangle, color: "text-chart-3" },
  4: { label: "Inteligencia Lateral", description: "Conexiones no evidentes entre datos distintos", icon: Brain, color: "text-chart-4" },
  5: { label: "Externos", description: "Factores del entorno macro y mercado", icon: Globe, color: "text-chart-5" },
};

function parsePatterns(answer: string): PatternResult {
  const patterns: Pattern[] = [];
  let verdict = "";
  let win_rate: number | undefined;
  let hypothesis_count: number | undefined;

  const lines = answer.split("\n");
  let currentLayer = 1;
  let currentPattern: Partial<Pattern> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.toLowerCase().includes("veredicto") || trimmed.toLowerCase().includes("verdict")) {
      verdict = trimmed.replace(/^[#*\-\s]*(?:veredicto|verdict)[:\s]*/i, "").trim();
      continue;
    }

    const wrMatch = trimmed.match(/win\s*rate[:\s]*(\d+(?:\.\d+)?)\s*%?/i) || trimmed.match(/tasa.*(?:éxito|acierto)[:\s]*(\d+(?:\.\d+)?)\s*%?/i);
    if (wrMatch) { win_rate = parseFloat(wrMatch[1]); continue; }

    const layerMatch = trimmed.match(/capa\s*(\d)/i) || trimmed.match(/layer\s*(\d)/i);
    if (layerMatch) { currentLayer = parseInt(layerMatch[1], 10); continue; }

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
      if (confMatch) { currentPattern.confidence = parseInt(confMatch[1], 10); continue; }
      const srcMatch = trimmed.match(/fuente[s]?[:\s]*(.*)/i) || trimmed.match(/source[s]?[:\s]*(.*)/i);
      if (srcMatch) { currentPattern.sources = srcMatch[1].split(",").map(s => s.trim()).filter(Boolean); continue; }
      const ceMatch = trimmed.match(/evidencia contraria[:\s]*(.*)/i) || trimmed.match(/contrary[:\s]*(.*)/i);
      if (ceMatch) { currentPattern.contrary_evidence = ceMatch[1].trim(); continue; }
      if (trimmed.length > 20) {
        currentPattern.description = (currentPattern.description || "") + " " + trimmed;
      }
    }
  }

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

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-chart-2" : value >= 60 ? "bg-chart-3" : "bg-destructive";
  const label = value >= 80 ? "Alta" : value >= 60 ? "Media" : "Baja";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{value}% — {label}</span>
    </div>
  );
}

function PatternItem({ pattern }: { pattern: Pattern }) {
  return (
    <AccordionItem value={pattern.title} className="border rounded-lg px-4 mb-2 bg-card">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center gap-3 text-left w-full pr-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{pattern.title}</p>
            <ConfidenceBar value={pattern.confidence} />
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-1 pb-2">
          {/* Full description */}
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {pattern.description || "Sin descripción disponible."}
          </p>

          {/* Sources */}
          {pattern.sources.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Fuentes</p>
              <div className="flex flex-wrap gap-1">
                {pattern.sources.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Contrary evidence */}
          {pattern.contrary_evidence && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-medium text-destructive flex items-center gap-1 mb-1">
                <AlertTriangle className="h-3 w-3" />
                Evidencia contraria
              </p>
              <p className="text-xs text-muted-foreground">{pattern.contrary_evidence}</p>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function Patrones() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PatternResult | null>(null);
  const [rawAnswer, setRawAnswer] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
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
  }, []);

  const saveToDb = async (parsed: PatternResult, raw: string) => {
    try {
      await supabase.from("ai_agent_tasks").delete().eq("agente_tipo", "patrones_cache");
      await supabase.from("ai_agent_tasks").insert({
        agente_tipo: "patrones_cache",
        estado: "completado",
        resultado: { parsed, raw } as any,
        creado_por: user?.id || null,
      });
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
    sessionStorage.setItem("ava-preload-prompt", "Analiza los patrones detectados en profundidad. ¿Cuáles tienen mayor probabilidad de éxito y por qué?");
    navigate("/asistente");
  };

  const groupedByLayer = result
    ? Object.entries(LAYER_CONFIG).map(([layerNum, config]) => ({
        layer: parseInt(layerNum, 10),
        config,
        patterns: result.patterns.filter(p => p.layer === parseInt(layerNum, 10)),
      })).filter(g => g.patterns.length > 0)
    : [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Patrones de Inteligencia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Señales y tendencias detectadas por los especialistas IA, organizadas por nivel de profundidad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchPatterns} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {result ? "Actualizar" : "Cargar patrones"}
          </Button>
          <Button variant="outline" size="sm" onClick={openAvaWithPatterns}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Consultar AVA
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="py-4 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {result && (
        <Card>
          <CardContent className="py-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Veredicto</p>
                  <p className="text-sm font-semibold mt-0.5">{result.verdict || "Sin veredicto"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-chart-2 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Win Rate Backtest</p>
                  <p className="text-lg font-bold mt-0.5">{result.win_rate != null ? `${result.win_rate}%` : "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-chart-4 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Patrones detectados</p>
                  <p className="text-lg font-bold mt-0.5">{result.hypothesis_count ?? "—"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patterns by layer */}
      {groupedByLayer.map(({ layer, config, patterns }) => {
        const LayerIcon = config.icon;
        return (
          <div key={layer} className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <LayerIcon className={`h-4 w-4 ${config.color}`} />
              <h2 className="text-base font-semibold">{config.label}</h2>
              <span className="text-xs text-muted-foreground">— {config.description}</span>
              <Badge variant="outline" className="ml-auto text-xs">{patterns.length}</Badge>
            </div>
            <Accordion type="multiple" className="space-y-0">
              {patterns.map((p, idx) => (
                <PatternItem key={idx} pattern={p} />
              ))}
            </Accordion>
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
              Pulsa "Cargar patrones" para obtener los patrones detectados por los especialistas IA.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
