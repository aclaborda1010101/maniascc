import { useState, useCallback, useEffect } from "react";
import { FlaskConical, Play, Star, Loader2, Clock, BookOpen, Wrench, History, Database, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

/* ── RAG Sources ── */
const RAG_SOURCES = [
  { key: "centros_comerciales", label: "Centros Comerciales España", domain: "centros_comerciales" },
  { key: "normativa", label: "Normativa Retail", domain: "normativa" },
  { key: "benchmarks", label: "Benchmarks Mercado", domain: "benchmarks" },
  { key: "operadores", label: "Operadores Nacionales", domain: "operadores" },
  { key: "demografia", label: "Demografía y Zonas", domain: "demografia" },
  { key: "negociacion", label: "Negociación Inmobiliaria", domain: "negociacion" },
  { key: "documentos", label: "Documentos Internos", domain: "documentos_internos" },
  { key: "historico", label: "Histórico Transacciones", domain: "historico" },
] as const;

/* ── Agent Modes ── */
const AGENTS = [
  { key: "standard", label: "Estándar", color: "bg-blue-500/10 text-blue-600 border-blue-200", prompt: "" },
  { key: "concise", label: "Conciso", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", prompt: "Responde de forma muy concisa y directa, máximo 3 párrafos." },
  { key: "analytical", label: "Analítico", color: "bg-purple-500/10 text-purple-600 border-purple-200", prompt: "Analiza en profundidad. Usa todas las herramientas disponibles para dar una respuesta completa con datos y métricas." },
  { key: "creative", label: "Creativo", color: "bg-amber-500/10 text-amber-600 border-amber-200", prompt: "Piensa de forma creativa y lateral. Propón ideas no convencionales y perspectivas alternativas." },
] as const;

/* ── Types ── */
interface CellResult {
  response: string;
  latencyMs: number;
  toolsUsed: string[];
  sourcesCount: number;
  loading: boolean;
  error: boolean;
}

interface PastEval {
  prompt: string;
  created_at: string;
  variante_index: number;
  variante_config: Record<string, unknown>;
  evaluacion: string | null;
}

const toolLabel = (t: string) => {
  const map: Record<string, string> = {
    db_query: "🔍 Datos", db_mutate: "✏️ Modificación",
    expert_forge: "🧠 Especialista", run_intelligence: "📊 Análisis",
    search_data: "🔎 Búsqueda",
  };
  return map[t] || t;
};

export default function Playground() {
  const { user } = useAuth();

  // Config
  const [prompt, setPrompt] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].key);
  const [selectedSource, setSelectedSource] = useState(RAG_SOURCES[0].key);
  const [includeAllAgents, setIncludeAllAgents] = useState(false);
  const [running, setRunning] = useState(false);

  // Results: Map<cellKey, CellResult>  cellKey = `${sourceKey}::${agentKey}`
  const [results, setResults] = useState<Record<string, CellResult>>({});
  const [bestVote, setBestVote] = useState<string | null>(null);
  const [hasResults, setHasResults] = useState(false);

  // Past evals
  const [pastEvals, setPastEvals] = useState<{ prompt: string; created_at: string; winner: string | null }[]>([]);

  const fetchPastEvals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("playground_evaluations" as never)
      .select("prompt, created_at, variante_index, variante_config, evaluacion" as never)
      .eq("usuario_id" as never, user.id as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(40 as never) as { data: PastEval[] | null };
    if (!data) return;
    const grouped = new Map<string, { prompt: string; created_at: string; winner: string | null }>();
    for (const row of data) {
      const key = `${row.prompt}::${row.created_at.slice(0, 16)}`;
      if (!grouped.has(key)) grouped.set(key, { prompt: row.prompt, created_at: row.created_at, winner: null });
      if (row.evaluacion === "mejor") {
        const cfg = row.variante_config as { sourceLabel?: string; agentLabel?: string };
        grouped.get(key)!.winner = `${cfg.sourceLabel || ""} + ${cfg.agentLabel || ""}`;
      }
    }
    setPastEvals(Array.from(grouped.values()).slice(0, 10));
  }, [user]);

  useEffect(() => { fetchPastEvals(); }, [fetchPastEvals]);

  /* ── Build cells to evaluate ── */
  const buildCells = () => {
    const cells: { sourceKey: string; sourceLabel: string; domain: string; agentKey: string; agentLabel: string; agentPrompt: string; agentColor: string }[] = [];

    // Primary axis: all 8 RAG sources × selected agent
    const agent = AGENTS.find(a => a.key === selectedAgent) || AGENTS[0];
    for (const src of RAG_SOURCES) {
      cells.push({
        sourceKey: src.key, sourceLabel: src.label, domain: src.domain,
        agentKey: agent.key, agentLabel: agent.label, agentPrompt: agent.prompt, agentColor: agent.color,
      });
    }

    // Secondary axis (optional): selected source × all agents (skip the already-selected combo)
    if (includeAllAgents) {
      const src = RAG_SOURCES.find(s => s.key === selectedSource) || RAG_SOURCES[0];
      for (const ag of AGENTS) {
        const cellKey = `${src.key}::${ag.key}`;
        if (!cells.some(c => `${c.sourceKey}::${c.agentKey}` === cellKey)) {
          cells.push({
            sourceKey: src.key, sourceLabel: src.label, domain: src.domain,
            agentKey: ag.key, agentLabel: ag.label, agentPrompt: ag.prompt, agentColor: ag.color,
          });
        }
      }
    }

    return cells;
  };

  /* ── Run evaluation ── */
  const runEvaluation = async () => {
    if (!prompt.trim() || running) return;
    const cells = buildCells();
    setRunning(true);
    setHasResults(true);
    setBestVote(null);

    // Init all cells as loading
    const init: Record<string, CellResult> = {};
    cells.forEach(c => {
      init[`${c.sourceKey}::${c.agentKey}`] = { response: "", latencyMs: 0, toolsUsed: [], sourcesCount: 0, loading: true, error: false };
    });
    setResults(init);

    await Promise.all(cells.map(async (cell) => {
      const cellKey = `${cell.sourceKey}::${cell.agentKey}`;
      const start = Date.now();
      try {
        const message = cell.agentPrompt
          ? `[INSTRUCCIÓN: ${cell.agentPrompt}]\n[FUENTE RAG PREFERIDA: ${cell.sourceLabel}]\n\n${prompt}`
          : `[FUENTE RAG PREFERIDA: ${cell.sourceLabel}]\n\n${prompt}`;

        const { data, error } = await supabase.functions.invoke("ava-orchestrator", {
          body: { message, history: [] },
        });
        const latencyMs = Date.now() - start;
        if (error) throw error;

        setResults(prev => ({
          ...prev,
          [cellKey]: {
            response: data?.answer || data?.response || "Sin respuesta",
            latencyMs,
            toolsUsed: data?.meta?.tools_used || [],
            sourcesCount: data?.meta?.sources_count || 0,
            loading: false,
            error: false,
          },
        }));
      } catch (err) {
        setResults(prev => ({
          ...prev,
          [cellKey]: {
            response: `❌ ${err instanceof Error ? err.message : "Error"}`,
            latencyMs: Date.now() - start,
            toolsUsed: [],
            sourcesCount: 0,
            loading: false,
            error: true,
          },
        }));
      }
    }));

    setRunning(false);
  };

  /* ── Vote best ── */
  const voteBest = async (cellKey: string) => {
    if (!user) return;
    setBestVote(cellKey);

    const [sourceKey, agentKey] = cellKey.split("::");
    const src = RAG_SOURCES.find(s => s.key === sourceKey);
    const ag = AGENTS.find(a => a.key === agentKey);
    const result = results[cellKey];
    if (!result || !src || !ag) return;

    try {
      await supabase.from("playground_evaluations" as never).insert({
        usuario_id: user.id,
        prompt,
        variante_index: AGENTS.indexOf(ag),
        variante_config: { sourceKey, agentKey, sourceLabel: src.label, agentLabel: ag.label },
        respuesta: result.response,
        latencia_ms: result.latencyMs,
        fuentes_consultadas: result.sourcesCount,
        tools_used: result.toolsUsed,
        evaluacion: "mejor",
      } as never);
      toast({ title: "⭐ Mejor respuesta guardada", description: `${src.label} + ${ag.label}` });
      fetchPastEvals();
    } catch {
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
    }
  };

  const cells = hasResults ? buildCells() : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          Playground
        </h1>
        <p className="text-sm text-muted-foreground">
          Compara respuestas cruzando fuentes RAG × agentes en paralelo
        </p>
      </div>

      {/* Config */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Textarea
            placeholder="Escribe tu pregunta para evaluar…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="resize-none"
          />

          <div className="flex flex-wrap items-end gap-4">
            {/* Agent selector */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Bot className="h-3 w-3" /> Agente principal</Label>
              <Select value={selectedAgent} onValueChange={(v) => setSelectedAgent(v as typeof selectedAgent)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGENTS.map(a => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle all agents */}
            <div className="flex items-center gap-2 pb-1">
              <Switch id="all-agents" checked={includeAllAgents} onCheckedChange={setIncludeAllAgents} />
              <Label htmlFor="all-agents" className="text-xs">+ Todos los agentes</Label>
            </div>

            {/* Source for agent axis */}
            {includeAllAgents && (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Database className="h-3 w-3" /> Fuente para eje agentes</Label>
                <Select value={selectedSource} onValueChange={(v) => setSelectedSource(v as typeof selectedSource)}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RAG_SOURCES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={runEvaluation} disabled={!prompt.trim() || running} size="lg" className="ml-auto">
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Evaluar ({buildCells().length} combinaciones)
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Eje principal:</span> 8 fuentes RAG × agente seleccionado
            {includeAllAgents && <><span className="font-medium ml-2">+ Eje secundario:</span> fuente elegida × 4 agentes</>}
          </div>
        </CardContent>
      </Card>

      {/* Results grid */}
      {hasResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cells.map((cell) => {
            const cellKey = `${cell.sourceKey}::${cell.agentKey}`;
            const r = results[cellKey];
            const isBest = bestVote === cellKey;

            return (
              <Card key={cellKey} className={`relative transition-all ${isBest ? "ring-2 ring-amber-400 shadow-lg" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        <Database className="h-2.5 w-2.5 mr-0.5" />{cell.sourceLabel}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${cell.agentColor}`}>
                        <Bot className="h-2.5 w-2.5 mr-0.5" />{cell.agentLabel}
                      </Badge>
                    </div>
                    {isBest && <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {r && !r.loading ? (
                    <>
                      {/* Metrics */}
                      <div className="flex gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{(r.latencyMs / 1000).toFixed(1)}s</span>
                        {r.sourcesCount > 0 && <span className="flex items-center gap-0.5"><BookOpen className="h-3 w-3" />{r.sourcesCount}</span>}
                        {r.toolsUsed.length > 0 && <span className="flex items-center gap-0.5"><Wrench className="h-3 w-3" />{r.toolsUsed.length}</span>}
                      </div>

                      {r.toolsUsed.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {r.toolsUsed.map((t, i) => (
                            <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">{toolLabel(t)}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Response */}
                      <div className="prose prose-sm max-w-none max-h-56 overflow-y-auto rounded bg-muted/30 p-2.5 text-xs leading-relaxed">
                        <ReactMarkdown>{r.response}</ReactMarkdown>
                      </div>

                      {/* Vote */}
                      <Button
                        size="sm"
                        variant={isBest ? "default" : "outline"}
                        className="text-xs h-7 w-full"
                        onClick={() => voteBest(cellKey)}
                        disabled={!!bestVote && !isBest}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        {isBest ? "⭐ Mejor respuesta" : "Elegir como mejor"}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-2 py-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-7 w-full" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Past evaluations */}
      {pastEvals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" /> Evaluaciones anteriores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead className="w-40">Fecha</TableHead>
                  <TableHead className="w-48">Ganadora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastEvals.map((ev, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm truncate max-w-md">{ev.prompt}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ev.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell>
                      {ev.winner ? (
                        <Badge variant="outline" className="text-xs">
                          <Star className="h-3 w-3 mr-1 text-amber-400 fill-amber-400" />{ev.winner}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
