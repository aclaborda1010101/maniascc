import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileDown, Copy, Eye, Code2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateForgeDocumentPdf, getForgeDocumentHtml, downloadBlob } from "@/services/pdfService";
import type { ForgeMode } from "@/services/ragService";

interface Props {
  mode: ForgeMode;
  modeLabel: string;
  data: any;
}

export function ForgePreview({ mode, modeLabel, data }: Props) {
  const { toast } = useToast();
  const [html, setHtml] = useState<string | null>(null);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isEmail = mode === "email_comunicacion";

  useEffect(() => {
    let active = true;
    setLoadingHtml(true);
    setHtml(null);
    getForgeDocumentHtml(mode, data, modeLabel).then((r) => {
      if (!active) return;
      setLoadingHtml(false);
      if (r.html) setHtml(r.html);
      else toast({ title: "Error generando preview", description: r.error || "", variant: "destructive" });
    });
    return () => { active = false; };
  }, [mode, modeLabel, data]);

  const handleExportPdf = async () => {
    setExporting(true);
    const { blob, error } = await generateForgeDocumentPdf(mode, data, modeLabel);
    if (blob) {
      downloadBlob(blob, `${modeLabel.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
      toast({ title: "PDF descargado" });
    } else {
      toast({ title: "Error PDF", description: error || "", variant: "destructive" });
    }
    setExporting(false);
  };

  const handleCopyHtml = () => {
    if (!html) return;
    navigator.clipboard.writeText(html);
    toast({ title: "HTML copiado" });
  };

  const handleCopyText = () => {
    if (isEmail) {
      const text = data?.plain_text_version || "";
      navigator.clipboard.writeText(text);
      toast({ title: "Texto copiado" });
    } else {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast({ title: "JSON copiado" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Vista previa profesional del documento. Usa <strong>Exportar PDF</strong> para descargarlo maquetado.
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopyText}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> {isEmail ? "Copiar texto" : "Copiar JSON"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopyHtml} disabled={!html}>
            <Code2 className="h-3.5 w-3.5 mr-1.5" /> Copiar HTML
          </Button>
          {!isEmail && (
            <Button size="sm" onClick={handleExportPdf} disabled={exporting} className="bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md">
              {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-1.5" />}
              Exportar PDF
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" /> Vista previa</TabsTrigger>
          <TabsTrigger value="html"><Code2 className="h-3.5 w-3.5 mr-1.5" /> HTML</TabsTrigger>
          <TabsTrigger value="json"><FileText className="h-3.5 w-3.5 mr-1.5" /> JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          <div className="border rounded-lg overflow-hidden bg-white" style={{ height: 720 }}>
            {loadingHtml && (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Maquetando preview…
              </div>
            )}
            {!loadingHtml && html && (
              <iframe
                title="Preview"
                srcDoc={html}
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="html">
          <pre className="border rounded-lg bg-muted/30 p-3 text-xs max-h-[720px] overflow-auto">
            {html || "—"}
          </pre>
        </TabsContent>

        <TabsContent value="json">
          <pre className="border rounded-lg bg-muted/30 p-3 text-xs max-h-[720px] overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
