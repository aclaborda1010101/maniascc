import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hammer, Loader2, Copy, FileDown } from "lucide-react";
import { generateForgeDocument, FORGE_MODES, ForgeMode } from "@/services/ragService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateProfessionalPdf, downloadBlob } from "@/services/pdfService";

export default function GeneradorDocumentos() {
  const { toast } = useToast();
  const [mode, setMode] = useState<ForgeMode>("dossier_operador");
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ model: string; latency_ms: number } | null>(null);
  const [selectedProyecto, setSelectedProyecto] = useState<string>("");

  const { data: proyectos } = useQuery({
    queryKey: ["proyectos-selector"],
    queryFn: async () => {
      const { data } = await supabase.from("proyectos").select("id, nombre").order("nombre");
      return data || [];
    },
  });

  const handleGenerate = async () => {
    if (!context.trim()) return;
    setLoading(true);
    setResult("");
    setMeta(null);
    const res = await generateForgeDocument(mode, context, selectedProyecto || undefined);
    if (res.error) {
      toast({ title: "Error FORGE", description: res.error, variant: "destructive" });
    } else {
      setResult(res.content);
      setMeta({ model: res.model, latency_ms: res.latency_ms });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Hammer className="h-6 w-6" /> Generador de Documentos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Genera documentos profesionales con inteligencia artificial</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* Mode selector */}
          <div className="grid gap-3 sm:grid-cols-3">
            {FORGE_MODES.map((m) => (
              <button key={m.value} onClick={() => setMode(m.value)}
                className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${mode === m.value ? "border-primary bg-primary/5" : "border-border"}`}>
                <span className="text-lg">{m.icon}</span>
                <p className="font-medium text-sm mt-1">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.description}</p>
              </button>
            ))}
          </div>

          {/* Optional project selector */}
          <div className="space-y-2">
            <Label>Oportunidad vinculada (opcional)</Label>
            <Select value={selectedProyecto} onValueChange={setSelectedProyecto}>
              <SelectTrigger><SelectValue placeholder="Sin vincular" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vincular</SelectItem>
                {proyectos?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Context */}
          <div className="space-y-2">
            <Label>Contexto / Instrucciones</Label>
            <Textarea placeholder="Describe qué necesitas generar con el mayor contexto posible..." value={context} onChange={(e) => setContext(e.target.value)} rows={4} />
          </div>

          {/* Generate */}
          <div className="flex items-center gap-3">
            <Button onClick={handleGenerate} disabled={loading || !context.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hammer className="h-4 w-4 mr-2" />} Generar documento
            </Button>
            {meta && <span className="text-xs text-muted-foreground">Modelo: {meta.model} · {meta.latency_ms}ms</span>}
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Resultado</Label>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result); toast({ title: "Copiado" }); }}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                  </Button>
                  <Button variant="outline" size="sm" disabled={exportingPdf} onClick={async () => {
                    setExportingPdf(true);
                    const modeInfo = FORGE_MODES.find(m => m.value === mode);
                    const { blob, error } = await generateProfessionalPdf(
                      modeInfo?.label || "Documento",
                      result,
                      modeInfo?.label
                    );
                    if (blob) {
                      downloadBlob(blob, `${modeInfo?.label || "documento"}.pdf`);
                      toast({ title: "PDF descargado" });
                    } else {
                      toast({ title: "Error", description: error, variant: "destructive" });
                    }
                    setExportingPdf(false);
                  }}>
                    {exportingPdf ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-1" />} Exportar PDF
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 max-h-[500px] overflow-y-auto">
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {!result && !loading && <p className="text-sm text-muted-foreground text-center py-6">Selecciona un tipo, proporciona contexto y genera.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
