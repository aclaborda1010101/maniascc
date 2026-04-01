import { useState, useRef, useEffect, useCallback } from "react";
import { FlaskConical, Play, Star, ThumbsUp, ThumbsDown, HelpCircle, Loader2, Clock, BookOpen, Wrench, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface VariantConfig {
  label: string;
  description: string;
  color: string;
  params: Record<string, unknown>;
}

const VARIANTS: VariantConfig[] = [
  {
    label: "Estándar",
    description: "Configuración por defecto con todas las herramientas",
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
    params: { mode: "standard" },
  },
  {
    label: "Conciso",
    description: "Respuesta breve, sin herramientas especializadas",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    params: { mode: "concise", system_override: "Responde de forma muy concisa y directa, máximo 3 párrafos." },
  },
  {
    label: "Analítico",
    description: "Mayor profundidad, fuerza uso de herramientas",
    color: "bg-purple-500/10 text-purple-600 border-purple-200",
    params: { mode: "analytical", system_override: "Analiza en profundidad. Usa todas las herramientas disponibles para dar una respuesta completa con datos y métricas." },
  },
  {
    label: "Creativo",
    description: "Perspectiva lateral, ideas no convencionales",
    color: "bg-amber-500/10 text-amber-600 border-amber-200",
    params: { mode: "creative", system_override: "Piensa de forma creativa y lateral. Propón ideas no convencionales y perspectivas alternativas. Sé audaz en tus recomendaciones." },
  },
];

type Evaluacion = "mejor" | "buena" | "mala" | "parcial";

interface VariantResult {
  response: string;
  latencyMs: number;
  toolsUsed: string[];
  sourcesCount: number;
  evaluacion: Evaluacion | null;
  saved: boolean;
}

export default function Playground() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<(VariantResult | null)[]>([null, null, null, null]);
  const [hasResults, setHasResults] = useState(false);
  const abortRef = useRef(false);

  interface PastEval {
    prompt: string;
    created_at: string;
    variante_index: number;
    variante_config: Record<string, unknown>;
    evaluacion: string | null;
  }
  const [pastEvals, setPastEvals] = useState<PastEval[]>([]);

  const fetchPastEvals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("playground_evaluations" as never)
      .select("prompt, created_at, variante_index, variante_config, evaluacion" as never)
      .eq("usuario_id" as never, user.id as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(40 as never) as { data: PastEval[] | null };
    if (data) {
      // Group by prompt+timestamp, find winner per group
      const grouped = new Map<string, { prompt: string; created_at: string; winner: string | null }>();
      for (const row of data) {
        const key = `${row.prompt}::${row.created_at.slice(0, 16)}`;
        if (!grouped.has(key)) {
          grouped.set(key, { prompt: row.prompt, created_at: row.created_at, winner: null });
        }
        if (row.evaluacion === "mejor") {
          const variantLabel = VARIANTS[row.variante_index]?.label || `Variante ${row.variante_index}`;
          grouped.get(key)!.winner = variantLabel;
        }
      }
      setPastEvals(Array.from(grouped.values()).slice(0, 10) as unknown as PastEval[]);
    }
  }, [user]);

  useEffect(() => { fetchPastEvals(); }, [fetchPastEvals]);
  const runEvaluation = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setHasResults(true);
    setResults([null, null, null, null]);
    abortRef.current = false;

    const promises = VARIANTS.map(async (variant, idx) => {
      const start = Date.now();
      try {
        const body: Record<string, unknown> = {
          message: variant.params.system_override
            ? `[INSTRUCCIÓN DE MODO: ${variant.params.system_override}]\n\n${prompt}`
            : prompt,
          history: [],
        };

        const { data, error } = await supabase.functions.invoke("ava-orchestrator", { body });

        const latencyMs = Date.now() - start;
        if (error) throw error;

        const toolsUsed: string[] = data?.meta?.tools_used || [];
        const sourcesCount = data?.meta?.sources_count || toolsUsed.length;

        const result: VariantResult = {
          response: data?.answer || data?.response || "Sin respuesta",
          latencyMs,
          toolsUsed,
          sourcesCount,
          evaluacion: null,
          saved: false,
        };

        setResults((prev) => {
          const next = [...prev];
          next[idx] = result;
          return next;
        });
      } catch (err: unknown) {
        const latencyMs = Date.now() - start;
        const errorMsg = err instanceof Error ? err.message : "Error desconocido";
        setResults((prev) => {
          const next = [...prev];
          next[idx] = {
            response: `❌ Error: ${errorMsg}`,
            latencyMs,
            toolsUsed: [],
            sourcesCount: 0,
            evaluacion: null,
            saved: false,
          };
          return next;
        });
      }
    });

    await Promise.all(promises);
    setLoading(false);
  };

  const setEvaluacion = async (idx: number, evaluacion: Evaluacion) => {
    const result = results[idx];
    if (!result || !user) return;

    // If selecting "mejor", clear any previous "mejor"
    const updatedResults = results.map((r, i) => {
      if (!r) return r;
      if (evaluacion === "mejor" && i !== idx && r.evaluacion === "mejor") {
        return { ...r, evaluacion: null as Evaluacion | null, saved: false };
      }
      if (i === idx) {
        return { ...r, evaluacion, saved: false };
      }
      return r;
    });
    setResults(updatedResults);

    // Save to DB
    try {
      const { error } = await supabase.from("playground_evaluations" as never).insert({
        usuario_id: user.id,
        prompt,
        variante_index: idx,
        variante_config: VARIANTS[idx].params,
        respuesta: result.response,
        latencia_ms: result.latencyMs,
        fuentes_consultadas: result.sourcesCount,
        tools_used: result.toolsUsed,
        evaluacion,
      } as never);

      if (error) throw error;

      setResults((prev) => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx]!, saved: true };
        return next;
      });

      toast({ title: "Evaluación guardada", description: `Variante "${VARIANTS[idx].label}" → ${evaluacion}` });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar la evaluación", variant: "destructive" });
    }
  };

  const toolLabel = (t: string) => {
    const map: Record<string, string> = {
      db_query: "🔍 Datos",
      db_mutate: "✏️ Modificación",
      expert_forge: "🧠 Especialista",
      run_intelligence: "📊 Análisis",
      search_data: "🔎 Búsqueda",
    };
    return map[t] || t;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          Playground
        </h1>
        <p className="text-sm text-muted-foreground">
          Evalúa y compara 4 variantes de respuesta de AVA en paralelo
        </p>
      </div>

      {/* Prompt input */}
      <Card>
        <CardContent className="pt-6">
          <Textarea
            placeholder="Escribe tu prompt para evaluar... (ej: '¿Qué operadores encajarían mejor en un local de 200m² en zona prime de Madrid?')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-2 flex-wrap">
              {VARIANTS.map((v, i) => (
                <Badge key={i} variant="outline" className={v.color}>
                  {v.label}
                </Badge>
              ))}
            </div>
            <Button onClick={runEvaluation} disabled={!prompt.trim() || loading} size="lg">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Evaluar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results grid */}
      {hasResults && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {VARIANTS.map((variant, idx) => {
            const result = results[idx];
            return (
              <Card key={idx} className={`relative ${result?.evaluacion === "mejor" ? "ring-2 ring-amber-400" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant="outline" className={variant.color}>
                        {variant.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-normal">{variant.description}</span>
                    </CardTitle>
                    {result?.evaluacion === "mejor" && (
                      <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Metrics */}
                  {result ? (
                    <>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {(result.latencyMs / 1000).toFixed(1)}s
                        </span>
                        {result.sourcesCount > 0 && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {result.sourcesCount} fuentes
                          </span>
                        )}
                        {result.toolsUsed.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Wrench className="h-3 w-3" />
                            {result.toolsUsed.length} tools
                          </span>
                        )}
                      </div>

                      {/* Tools badges */}
                      {result.toolsUsed.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {result.toolsUsed.map((t, ti) => (
                            <Badge key={ti} variant="secondary" className="text-[10px]">
                              {toolLabel(t)}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Response */}
                      <div className="prose prose-sm max-w-none max-h-64 overflow-y-auto rounded bg-muted/30 p-3 text-sm">
                        <ReactMarkdown>{result.response}</ReactMarkdown>
                      </div>

                      {/* Evaluation buttons */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant={result.evaluacion === "mejor" ? "default" : "outline"}
                          className="text-xs h-7"
                          onClick={() => setEvaluacion(idx, "mejor")}
                        >
                          <Star className="h-3 w-3 mr-1" /> Mejor
                        </Button>
                        <Button
                          size="sm"
                          variant={result.evaluacion === "buena" ? "default" : "outline"}
                          className="text-xs h-7"
                          onClick={() => setEvaluacion(idx, "buena")}
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" /> Buena
                        </Button>
                        <Button
                          size="sm"
                          variant={result.evaluacion === "mala" ? "default" : "outline"}
                          className="text-xs h-7"
                          onClick={() => setEvaluacion(idx, "mala")}
                        >
                          <ThumbsDown className="h-3 w-3 mr-1" /> Mala
                        </Button>
                        <Button
                          size="sm"
                          variant={result.evaluacion === "parcial" ? "default" : "outline"}
                          className="text-xs h-7"
                          onClick={() => setEvaluacion(idx, "parcial")}
                        >
                          <HelpCircle className="h-3 w-3 mr-1" /> Parcial
                        </Button>
                        {result.saved && (
                          <span className="text-[10px] text-muted-foreground self-center ml-auto">✓ guardado</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-7 w-48" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
