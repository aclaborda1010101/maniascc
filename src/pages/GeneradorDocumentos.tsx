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

function markdownToHtml(text: string, title: string, modeLabel: string): string {
  let html = text
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:18px 0 8px;color:#1a1a2e;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:22px 0 10px;color:#1a1a2e;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;margin:24px 0 12px;color:#1a1a2e;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)$/gm, '<li style="margin:3px 0;">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:3px 0;">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0;line-height:1.6;">')
    .replace(/\n/g, '<br/>');

  html = html.replace(/(<li[^>]*>.*?<\/li>(\s*<br\/>)?)+/g, (match) => {
    const cleaned = match.replace(/<br\/>/g, '');
    return `<ul style="margin:8px 0 8px 20px;padding:0;">${cleaned}</ul>`;
  });

  const now = new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { margin: 2cm; size: A4; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; font-size: 11px; line-height: 1.6; }
    .header { border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; margin: 0; color: #1a1a2e; }
    .header .meta { font-size: 10px; color: #64748b; margin-top: 4px; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .content p { margin: 8px 0; }
    .badge { display: inline-block; background: #6366f1; color: white; font-size: 9px; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="meta">
      <span class="badge">${modeLabel}</span> &nbsp;·&nbsp; Generado el ${now} &nbsp;·&nbsp; F&G Real Estate
    </div>
  </div>
  <div class="content">
    <p style="margin:8px 0;line-height:1.6;">${html}</p>
  </div>
  <div class="footer">Documento generado por FORGE IA — F&G Real Estate</div>
</body>
</html>`;
}

function exportToPdf(content: string, mode: ForgeMode) {
  const modeInfo = FORGE_MODES.find(m => m.value === mode);
  const title = modeInfo?.label || "Documento FORGE";
  const htmlContent = markdownToHtml(content, title, `${modeInfo?.icon || "📄"} ${title}`);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 300); };
  setTimeout(() => { printWindow.print(); }, 800);
}

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
                  <Button variant="outline" size="sm" onClick={() => { exportToPdf(result, mode); toast({ title: "Exportando PDF" }); }}>
                    <FileDown className="h-3.5 w-3.5 mr-1" /> Exportar PDF
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
