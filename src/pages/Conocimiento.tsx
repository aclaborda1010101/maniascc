import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Send, Loader2, Database, FileText, Zap, RefreshCw, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ragSearch, fetchRagStats, enqueueAllPending, processBatch, RagStats } from "@/services/ragAdminService";
import { FeedbackWidget } from "@/components/FeedbackWidget";

interface Citation {
  documento_id?: string;
  nombre: string;
  chunk_index?: number;
}

export default function Conocimiento() {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [dominio, setDominio] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<{ answer: string; citations: Citation[] | string[]; confidence: number } | null>(null);
  const [stats, setStats] = useState<RagStats | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);

  useEffect(() => {
    void refreshStats();
  }, []);

  const refreshStats = async () => {
    const s = await fetchRagStats();
    if (s) setStats(s);
  };

  const handleSearch = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    const filters: { dominio?: string } = {};
    if (dominio !== "todos") filters.dominio = dominio;
    const result = await ragSearch(question, filters);
    if ("error" in result && result.error) {
      toast({ title: "Error", description: (result as any).message, variant: "destructive" });
    } else {
      setAnswer(result as any);
    }
    setLoading(false);
  };

  const handleEnqueue = async () => {
    try {
      setBatchRunning(true);
      const r = await enqueueAllPending();
      toast({
        title: "Cola actualizada",
        description: `${r.enqueued} tareas en cola (clasificar: ${r.breakdown.classify}, indexar: ${r.breakdown.ingest}, embeddings: ${r.breakdown.embed})`,
      });
      await refreshStats();
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setBatchRunning(false);
    }
  };

  const handleRunBatch = async (taskType?: "classify" | "ingest" | "embed") => {
    try {
      setBatchRunning(true);
      let totalOk = 0,
        totalKo = 0,
        iter = 0;
      // Proceso varios lotes hasta agotar (max 20 iteraciones por click = 100 docs si batch=5)
      while (iter < 20) {
        const r = await processBatch(taskType, 5);
        totalOk += r.ok;
        totalKo += r.ko;
        if (r.processed === 0) break;
        iter++;
        await refreshStats();
      }
      toast({
        title: "Lote procesado",
        description: `${totalOk} ok · ${totalKo} errores en ${iter} ciclos`,
      });
      await refreshStats();
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setBatchRunning(false);
    }
  };

  const totalDocs = stats?.documents.total || 0;
  const classifyPct = totalDocs ? Math.round(((stats?.documents.classified || 0) / totalDocs) * 100) : 0;
  const indexPct = totalDocs ? Math.round(((stats?.documents.indexed || 0) / totalDocs) * 100) : 0;
  const embedPct = stats?.chunks.total
    ? Math.round((stats.chunks.with_embedding / stats.chunks.total) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-8 w-8 text-accent" /> Conocimiento RAG
        </h1>
        <p className="text-muted-foreground mt-1">
          Buscador global sobre todos los documentos indexados de la plataforma.
        </p>
      </div>

      {/* SEARCH */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pregunta a la base documental</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={dominio} onValueChange={setDominio}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los dominios</SelectItem>
                <SelectItem value="contratos">📄 Contratos</SelectItem>
                <SelectItem value="operadores">🏪 Operadores</SelectItem>
                <SelectItem value="activos">🏢 Activos</SelectItem>
                <SelectItem value="centros_comerciales">🏬 Centros comerciales</SelectItem>
                <SelectItem value="comunicaciones">✉️ Comunicaciones</SelectItem>
                <SelectItem value="mercado">📈 Mercado</SelectItem>
                <SelectItem value="personas">👤 Personas</SelectItem>
                <SelectItem value="general">📁 General</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Ej: condiciones del contrato de Mercadona, KPIs del centro X, perfil de un operador..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading || !question.trim()} className="bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {answer && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm whitespace-pre-wrap">{answer.answer}</p>
              {Array.isArray(answer.citations) && answer.citations.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Fuentes:</p>
                  <div className="flex flex-wrap gap-1">
                    {answer.citations.map((c: any, i) => {
                      const label = typeof c === "string" ? c : c.nombre || "Documento";
                      const docId = typeof c === "object" ? c.documento_id : undefined;
                      return docId ? (
                        <Link key={i} to={`/documentos?doc=${docId}`}>
                          <Badge variant="outline" className="text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer">
                            <FileText className="h-3 w-3 mr-1" />
                            {label}
                          </Badge>
                        </Link>
                      ) : (
                        <Badge key={i} variant="outline" className="text-xs">{label}</Badge>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Confianza: {Math.round((answer.confidence || 0) * 100)}%</span>
                <FeedbackWidget entidadTipo="rag_response" entidadId={(answer.answer || "").slice(0, 50)} />
              </div>
            </div>
          )}
          {!answer && !loading && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Pregunta cualquier cosa relacionada con tus documentos. La búsqueda es híbrida (textual + semántica).
            </p>
          )}
        </CardContent>
      </Card>

      {/* STATS + ADMIN */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Database className="h-4 w-4" /> Documentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{totalDocs.toLocaleString("es-ES")}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Clasificados</span><span>{classifyPct}%</span>
              </div>
              <Progress value={classifyPct} className="h-1.5" />
              <div className="flex justify-between text-xs">
                <span>Indexados</span><span>{indexPct}%</span>
              </div>
              <Progress value={indexPct} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Zap className="h-4 w-4" /> Búsqueda semántica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{(stats?.chunks.total || 0).toLocaleString("es-ES")}</p>
            <p className="text-xs text-muted-foreground">fragmentos totales</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Con embedding</span><span>{embedPct}%</span>
              </div>
              <Progress value={embedPct} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4" /> Cola de reprocesado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {stats && Object.keys(stats.queue).length > 0 ? (
              Object.entries(stats.queue).map(([type, statuses]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="capitalize">{type}</span>
                  <div className="flex gap-1">
                    {Object.entries(statuses).map(([est, n]) => (
                      <Badge key={est} variant={est === "done" ? "secondary" : est === "error" ? "destructive" : "outline"} className="text-[10px] h-4">
                        {est}: {n}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Cola vacía. Pulsa "Encolar pendientes" para empezar.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mantenimiento masivo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          <Button onClick={handleEnqueue} disabled={batchRunning} className="w-full sm:w-auto h-11 sm:h-9 rounded-xl gradient-iridescent text-white border-0 hover:opacity-95">
            {batchRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Encolar pendientes
          </Button>
          <Button onClick={() => handleRunBatch("classify")} disabled={batchRunning} className="w-full sm:w-auto h-11 sm:h-9 rounded-xl gradient-iridescent text-white border-0 hover:opacity-95">
            <PlayCircle className="h-4 w-4 mr-2" /> Clasificar lote
          </Button>
          <Button onClick={() => handleRunBatch("ingest")} disabled={batchRunning} className="w-full sm:w-auto h-11 sm:h-9 rounded-xl gradient-iridescent text-white border-0 hover:opacity-95">
            <PlayCircle className="h-4 w-4 mr-2" /> Indexar lote
          </Button>
          <Button onClick={() => handleRunBatch("embed")} disabled={batchRunning} className="w-full sm:w-auto h-11 sm:h-9 rounded-xl gradient-iridescent text-white border-0 hover:opacity-95">
            <PlayCircle className="h-4 w-4 mr-2" /> Generar embeddings
          </Button>
          <Button onClick={refreshStats} disabled={batchRunning} variant="outline" className="w-full sm:w-auto h-11 sm:h-9 rounded-xl">
            <RefreshCw className="h-4 w-4 mr-2" /> Refrescar stats
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
