import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Loader2, RefreshCw, MessageSquare, ShieldCheck, Zap, ChevronDown, ChevronUp } from "lucide-react";
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
}

interface PatternResult {
  verdict?: string;
  win_rate?: number;
  patterns: Pattern[];
}

function parsePatterns(answer: string): PatternResult {
  const patterns: Pattern[] = [];
  let verdict = "";
  let win_rate: number | undefined;

  // Try JSON first (in case the AI returns structured data)
  try {
    const jsonMatch = answer.match(/```json\s*([\s\S]*?)```/) || answer.match(/\{[\s\S]*"patterns"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      if (parsed.patterns) return parsed;
    }
  } catch {}

  // Split by pattern markers: numbered items, bold titles, or headers
  const sections = answer.split(/(?=\n\s*(?:\d+[\.\)]\s+|\*\*[^*]+\*\*|#{1,3}\s+))/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.length < 15) continue;

    // Extract verdict
    const verdictMatch = trimmed.match(/veredicto[:\s]*[*]*\s*(.*?)(?:\n|$)/i);
    if (verdictMatch) {
      verdict = verdictMatch[1].replace(/\*\*/g, "").trim();
    }

    // Extract win rate
    const wrMatch = trimmed.match(/win\s*rate[^:]*[:\s]*(\d+(?:\.\d+)?)\s*%?/i) ||
                    trimmed.match(/tasa.*(?:éxito|acierto)[:\s]*(\d+(?:\.\d+)?)\s*%?/i);
    if (wrMatch) {
      win_rate = parseFloat(wrMatch[1]);
    }

    // Try to extract a pattern from this section
    const titleMatch = trimmed.match(/^(?:\d+[\.\)]\s+)?(?:\*\*)?([^*\n]{8,80})(?:\*\*)?/);
    if (!titleMatch) continue;

    const title = titleMatch[1]
      .replace(/\*\*/g, "")
      .replace(/^#+\s*/, "")
      .replace(/^[-•]\s*/, "")
      .trim();

    // Skip meta-lines that aren't real patterns
    if (/^(veredicto|verdict|resumen ejecutivo|win rate|backtest|capa \d|layer \d|hipótesis|patrones detectados)/i.test(title)) continue;
    if (/^\*\s*(Confianza|Título|Fuente|Evidencia)/i.test(title)) continue;

    // Get the rest as description
    const descLines = trimmed.split("\n").slice(1);
    let description = "";
    let confidence = 70;
    let sources: string[] = [];
    let contrary_evidence: string | undefined;

    for (const line of descLines) {
      const l = line.trim();
      const confMatch = l.match(/confianza[:\s]*(\d+)/i) || l.match(/confidence[:\s]*(\d+)/i);
      if (confMatch) { confidence = parseInt(confMatch[1], 10); continue; }

      const srcMatch = l.match(/fuente[s]?[:\s]*(.*)/i) || l.match(/source[s]?[:\s]*(.*)/i);
      if (srcMatch) { sources = srcMatch[1].split(",").map(s => s.trim().replace(/\*\*/g, "")).filter(Boolean); continue; }

      const ceMatch = l.match(/evidencia contraria[:\s]*(.*)/i) || l.match(/contrary[:\s]*(.*)/i);
      if (ceMatch) { contrary_evidence = ceMatch[1].trim(); continue; }

      // Skip sub-metadata lines
      if (/^\*\s*(Confianza|Título|Fuente|Win Rate|Backtest)/i.test(l)) continue;

      if (l.length > 5) {
        description += (description ? " " : "") + l.replace(/^\*\s*/, "").replace(/\*\*/g, "");
      }
    }

    if (title.length > 5) {
      patterns.push({ title, confidence, description: description.trim(), sources, contrary_evidence });
    }
  }

  // Fallback: if parsing found nothing, create a single entry
  if (patterns.length === 0 && answer.trim()) {
    // Try to extract meaningful paragraphs
    const paragraphs = answer.split(/\n\n+/).filter(p => p.trim().length > 30);
    if (paragraphs.length > 0) {
      for (const para of paragraphs.slice(0, 8)) {
        const firstLine = para.trim().split("\n")[0].replace(/[#*\-]/g, "").trim();
        const rest = para.trim().split("\n").slice(1).join(" ").replace(/\*\*/g, "").trim();
        if (firstLine.length > 5 && firstLine.length < 100) {
          patterns.push({
            title: firstLine.slice(0, 80),
            confidence: 70,
            description: rest || firstLine,
            sources: [],
          });
        }
      }
    }
    if (patterns.length === 0) {
      patterns.push({
        title: "Análisis general",
        confidence: 70,
        description: answer.slice(0, 800).replace(/\*\*/g, ""),
        sources: ["Expert Forge MoE"],
      });
    }
  }

  return { verdict, win_rate, patterns };
}

function ConfidencePill({ value }: { value: number }) {
  const variant = value >= 80 ? "default" : value >= 60 ? "secondary" : "destructive";
  const label = value >= 80 ? "Alta" : value >= 60 ? "Media" : "Baja";
  return (
    <Badge variant={variant} className="text-xs font-medium shrink-0">
      {value}% {label}
    </Badge>
  );
}

function PatternCard({ pattern, defaultOpen = false }: { pattern: Pattern; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        {/* Header row */}
        <button
          onClick={() => setOpen(!open)}
          className="flex items-start justify-between gap-3 w-full text-left"
        >
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-snug">{pattern.title}</h3>
            {!open && pattern.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {pattern.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <ConfidencePill value={pattern.confidence} />
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {/* Expanded content */}
        {open && (
          <div className="mt-3 space-y-3 border-t pt-3">
            {/* Full description */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Descripción</p>
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {pattern.description || "Sin descripción disponible."}
              </p>
            </div>

            {/* Sources */}
            {pattern.sources.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Fuentes</p>
                <div className="flex flex-wrap gap-1">
                  {pattern.sources.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Contrary evidence */}
            {pattern.contrary_evidence && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive mb-1">⚠ Evidencia contraria</p>
                <p className="text-xs">{pattern.contrary_evidence}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
          message: `Analiza los datos disponibles y detecta patrones relevantes para el negocio. 
Para cada patrón devuelve en formato estructurado:
1. Título claro y descriptivo (máximo 10 palabras)
2. Confianza: porcentaje (0-100)
3. Descripción: 2-4 frases explicando en qué consiste el patrón, por qué es relevante y qué implica para la toma de decisiones
4. Fuentes: de dónde viene la información
5. Evidencia contraria: si la hay

Devuelve también un veredicto general (1-2 frases) y el win rate del backtest si está disponible.
Mínimo 3 patrones, máximo 8.`,
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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Patrones de Inteligencia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Señales y tendencias detectadas por los especialistas IA.
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
        <div className="space-y-3">
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

      {/* Summary bar */}
      {result && (
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm">
                  <span className="text-muted-foreground">Veredicto: </span>
                  <span className="font-medium">{result.verdict || "Sin veredicto"}</span>
                </span>
              </div>
              {result.win_rate != null && (
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-chart-2 shrink-0" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Win Rate: </span>
                    <span className="font-semibold">{result.win_rate}%</span>
                  </span>
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                {result.patterns.length} patrones
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pattern cards */}
      {result && (
        <div className="space-y-3">
          {result.patterns.map((p, idx) => (
            <PatternCard key={idx} pattern={p} defaultOpen={idx === 0} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Brain className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg">Sin patrones cargados</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Pulsa "Cargar patrones" para que la IA analice los datos y detecte tendencias relevantes.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
