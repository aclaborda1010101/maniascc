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

/* ── Context Modes (eje principal) ── */
const CONTEXT_MODES = [
  { key: "solo_interno", label: "Solo Interno", instruction: "Usa SOLO fuentes internas (documentos del proyecto, datos propios). No consultes fuentes externas." },
  { key: "solo_externo", label: "Solo Externo", instruction: "Usa SOLO fuentes externas (benchmarks, normativa, mercado). No consultes documentos internos." },
  { key: "interno_externo", label: "Interno+Externo", instruction: "Combina fuentes internas y externas para una respuesta completa." },
  { key: "sin_rag", label: "Sin RAG", instruction: "Responde sin consultar ninguna fuente RAG, solo con tu conocimiento base." },
] as const;

/* ── Agents ── */
const AGENTS = [
  { key: "coordinador", id: "59d5e344-f6f8-42b8-93ba-c8c7dbe204b5", label: "Coordinador", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { key: "atlas", id: "442a4ad6-c740-49d1-bd96-42a37a6b09ec", label: "ATLAS", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  { key: "forge7", id: "0de742b5-1048-455a-8fbd-a710fa300b45", label: "FORGE7", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  { key: "matching", id: "6a2cfd5e-e81a-4486-bb96-1d52e7bd0dd0", label: "MATCHING", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  { key: "auditoria", id: "6ace2754-f6e2-4e95-bd58-f476096cd74b", label: "AUDITORIA", color: "bg-rose-500/10 text-rose-600 border-rose-200" },
  { key: "scraping", id: "24d75154-48fd-4203-8d82-8ba8ad2a1540", label: "SCRAPING", color: "bg-cyan-500/10 text-cyan-600 border-cyan-200" },
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
  const [selectedContext, setSelectedContext] = useState(CONTEXT_MODES[0].key);
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
        const cfg = row.variante_config as { contextLabel?: string; sourceLabel?: string; agentLabel?: string };
        grouped.get(key)!.winner = `${cfg.contextLabel || cfg.sourceLabel || ""} + ${cfg.agentLabel || ""}`;
      }
    }
    setPastEvals(Array.from(grouped.values()).slice(0, 10));
  }, [user]);

  useEffect(() => { fetchPastEvals(); }, [fetchPastEvals]);

  /* ── Build cells to evaluate ── */
  const buildCells = () => {
    const cells: { contextKey: string; contextLabel: string; contextInstruction: string; agentKey: string; agentId: string; agentLabel: string; agentColor: string }[] = [];

    // Primary axis: 4 context modes × selected agent
    const agent = AGENTS.find(a => a.key === selectedAgent) || AGENTS[0];
    for (const ctx of CONTEXT_MODES) {
      cells.push({
        contextKey: ctx.key, contextLabel: ctx.label, contextInstruction: ctx.instruction,
        agentKey: agent.key, agentId: agent.id, agentLabel: agent.label, agentColor: agent.color,
      });
    }

    // Secondary axis (optional): selected context × all agents (skip already-selected combo)
    if (includeAllAgents) {
      const ctx = CONTEXT_MODES.find(c => c.key === selectedContext) || CONTEXT_MODES[0];
      for (const ag of AGENTS) {
        const cellKey = `${ctx.key}::${ag.key}`;
        if (!cells.some(c => `${c.contextKey}::${c.agentKey}` === cellKey)) {
          cells.push({
            contextKey: ctx.key, contextLabel: ctx.label, contextInstruction: ctx.instruction,
            agentKey: ag.key, agentId: ag.id, agentLabel: ag.label, agentColor: ag.color,
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
      init[`${c.contextKey}::${c.agentKey}`] = { response: "", latencyMs: 0, toolsUsed: [], sourcesCount: 0, loading: true, error: false };
    });
    setResults(init);

    await Promise.all(cells.map(async (cell) => {
      const cellKey = `${cell.contextKey}::${cell.agentKey}`;
      const start = Date.now();
      try {
        const message = `[CONTEXTO: ${cell.contextInstruction}]\n[AGENTE: ${cell.agentLabel} (${cell.agentId})]\n\n${prompt}`;

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

    const [contextKey, agentKey] = cellKey.split("::");
    const ctx = CONTEXT_MODES.find(c => c.key === contextKey);
    const ag = AGENTS.find(a => a.key === agentKey);
    const result = results[cellKey];
    if (!result || !ctx || !ag) return;

    try {
      await supabase.from("playground_evaluations" as never).insert({
        usuario_id: user.id,
        prompt,
        variante_index: AGENTS.indexOf(ag),
        variante_config: { contextKey, agentKey, contextLabel: ctx.label, agentLabel: ag.label },
        respuesta: result.response,
        latencia_ms: result.latencyMs,
        fuentes_consultadas: result.sourcesCount,
        tools_used: result.toolsUsed,
        evaluacion: "mejor",
      } as never);
      toast({ title: "⭐ Mejor respuesta guardada", description: `${ctx.label} + ${ag.label}` });
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

            {/* Context for agent axis */}
            {includeAllAgents && (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Database className="h-3 w-3" /> Contexto para eje agentes</Label>
                <Select value={selectedContext} onValueChange={(v) => setSelectedContext(v as typeof selectedContext)}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTEXT_MODES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
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
            <span className="font-medium">Eje principal:</span> 4 modos de contexto × agente seleccionado
            {includeAllAgents && <><span className="font-medium ml-2">+ Eje secundario:</span> contexto elegido × 6 agentes</>}
          </div>
        </CardContent>
      </Card>

      {/* Results grid */}
      {hasResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cells.map((cell) => {
            const cellKey = `${cell.contextKey}::${cell.agentKey}`;
            const r = results[cellKey];
            const isBest = bestVote === cellKey;

            return (
              <Card key={cellKey} className={`relative transition-all ${isBest ? "ring-2 ring-amber-400 shadow-lg" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        <Database className="h-2.5 w-2.5 mr-0.5" />{cell.contextLabel}
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
