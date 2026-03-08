import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Send, Loader2, RefreshCw } from "lucide-react";
import { queryRAG, ingestDocument } from "@/services/ragService";
import { useToast } from "@/hooks/use-toast";

interface Props {
  proyectoId: string;
  docs: any[];
  onRefreshDocs: () => void;
}

export function ProyectoRAG({ proyectoId, docs, onRefreshDocs }: Props) {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; citations: string[]; confidence: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dominio, setDominio] = useState("todos");
  const [ingesting, setIngesting] = useState<string | null>(null);

  const handleQuery = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    const filters: Record<string, unknown> = { proyecto_id: proyectoId };
    if (dominio !== "todos") filters.dominio = dominio;
    const result = await queryRAG(question, filters);
    if ("error" in result && result.error) {
      toast({ title: "Error RAG", description: (result as any).message, variant: "destructive" });
    } else {
      setAnswer(result as any);
    }
    setLoading(false);
  };

  const handleIngest = async (docId: string) => {
    setIngesting(docId);
    const result = await ingestDocument(docId);
    if (result.success) { toast({ title: `Indexado: ${result.chunks_created} fragmentos` }); onRefreshDocs(); }
    else toast({ title: "Error", description: result.error, variant: "destructive" });
    setIngesting(null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Pregunta a tus documentos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={dominio} onValueChange={setDominio}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los dominios</SelectItem>
              <SelectItem value="contratos">📄 Contratos</SelectItem>
              <SelectItem value="operadores">🏪 Operadores</SelectItem>
              <SelectItem value="activos">🏢 Activos</SelectItem>
              <SelectItem value="mercado">📈 Mercado</SelectItem>
              <SelectItem value="personas">👤 Personas</SelectItem>
              <SelectItem value="general">📁 General</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input placeholder="¿Cuáles son las condiciones del contrato...?" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuery()} disabled={loading} />
            <Button onClick={handleQuery} disabled={loading || !question.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {answer && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm whitespace-pre-wrap">{answer.answer}</p>
              {answer.citations.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Fuentes:</p>
                  <div className="flex flex-wrap gap-1">{answer.citations.map((c, i) => <Badge key={i} variant="outline" className="text-xs">{c}</Badge>)}</div>
                </div>
              )}
              <span className="text-xs text-muted-foreground">Confianza: {Math.round(answer.confidence * 100)}%</span>
            </div>
          )}
          {!answer && !loading && <p className="text-sm text-muted-foreground text-center py-6">Haz una pregunta sobre los documentos indexados de este proyecto.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Documentos indexados</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay documentos. Sube documentos en la pestaña Documentos.</p>
          ) : docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{doc.nombre}</p>
                <Badge variant={doc.procesado_ia ? "secondary" : "outline"} className="text-[10px] h-4">{doc.procesado_ia ? "Indexado ✓" : "Sin indexar"}</Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleIngest(doc.id)} disabled={ingesting === doc.id} title={doc.procesado_ia ? "Reindexar" : "Indexar"}>
                {ingesting === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
