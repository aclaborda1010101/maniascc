import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Database, Loader2, RefreshCw, FlaskConical, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ReclasificacionPanel() {
  const [bfStatus, setBfStatus] = useState<any>(null);
  const [bfLoading, setBfLoading] = useState(false);
  const [bfRunning, setBfRunning] = useState<string | null>(null);
  const [bfProgress, setBfProgress] = useState<{ phase: string; processed: number; linked: number; remaining: number } | null>(null);

  useEffect(() => { fetchBfStatus(); }, []);

  const fetchBfStatus = async () => {
    setBfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("rag-backfill-links", { body: { phase: "status" } });
      if (error) throw error;
      setBfStatus(data);
    } catch (e: any) {
      toast({ title: "Error status", description: e.message, variant: "destructive" });
    } finally { setBfLoading(false); }
  };

  const runBackfill = async (phase: string, dryRun: boolean) => {
    if (!dryRun && !confirm(`Ejecutar la fase "${phase}"? Rellenará vínculos vacíos (reversible por fase).`)) return;
    setBfRunning(phase + (dryRun ? ":dry" : ""));
    setBfProgress({ phase, processed: 0, linked: 0, remaining: 0 });
    try {
      let totalProc = 0, totalLinked = 0;
      for (let i = 0; i < 200; i++) {
        const { data, error } = await supabase.functions.invoke("rag-backfill-links", { body: { phase, dry_run: dryRun, batch_size: 1000 } });
        if (error) throw error;
        totalProc += data.processed || 0;
        totalLinked += data.linked || 0;
        setBfProgress({ phase, processed: totalProc, linked: totalLinked, remaining: data.remaining || 0 });
        if (dryRun || data.done) break;
      }
      toast({ title: dryRun ? "Simulacro" : "Fase completa", description: `${phase}: ${totalLinked} vínculos ${dryRun ? "vinculables" : "creados"}` });
      await fetchBfStatus();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBfRunning(null);
      setBfProgress(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Reclasificación del archivo histórico</CardTitle>
          <Button size="sm" variant="outline" onClick={fetchBfStatus} disabled={bfLoading}>
            {bfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />} Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Vincula el archivo importado (documentos y adjuntos) a contactos, hilos y proyectos. No borra nada;
          solo rellena vínculos vacíos y es reversible por fase (queda registrado en <code>metadata_extraida.linked_by</code>).
        </p>

        {bfStatus && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Docs totales</p><p className="text-xl font-bold">{bfStatus.documentos?.total?.toLocaleString("es-ES")}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Con contacto</p><p className="text-xl font-bold text-chart-2">{bfStatus.documentos?.con_contacto?.toLocaleString("es-ES")}</p><p className="text-[10px] text-muted-foreground">Pendientes: {bfStatus.documentos?.pendientes_contacto?.toLocaleString("es-ES")}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Con proyecto</p><p className="text-xl font-bold text-chart-2">{bfStatus.documentos?.con_proyecto?.toLocaleString("es-ES")}</p><p className="text-[10px] text-muted-foreground">Pendientes: {bfStatus.documentos?.pendientes_proyecto?.toLocaleString("es-ES")}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Con operador</p><p className="text-xl font-bold">{bfStatus.documentos?.con_operador?.toLocaleString("es-ES")}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Chunks con proyecto</p><p className="text-xl font-bold">{bfStatus.chunks?.con_proyecto?.toLocaleString("es-ES")}</p><p className="text-[10px] text-muted-foreground">de {bfStatus.chunks?.total?.toLocaleString("es-ES")}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Proyectos duplicados</p><p className="text-xl font-bold">{bfStatus.proyectos_duplicados?.length || 0}</p><p className="text-[10px] text-muted-foreground">Se usa el más antiguo</p></div>
          </div>
        )}

        {bfProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>{bfProgress.phase} · procesados {bfProgress.processed} · vinculados {bfProgress.linked}</span>
              <span className="text-muted-foreground">restantes {bfProgress.remaining}</span>
            </div>
            <Progress value={bfProgress.remaining > 0 ? Math.min(95, (bfProgress.processed / (bfProgress.processed + bfProgress.remaining)) * 100) : 100} />
          </div>
        )}

        <div className="space-y-2">
          {[
            { key: "contactos_from", label: "1 · Contactos por remitente (from)", hint: "Match exacto de email del remitente contra contactos" },
            { key: "contactos_to", label: "2 · Contactos por destinatario (to)", hint: "Primer email del to que coincida con un contacto" },
            { key: "hilos", label: "3 · Herencia por hilo (thread_id)", hint: "Hereda contacto/proyecto/operador de otro doc del mismo hilo ya vinculado" },
            { key: "proyectos_tokens", label: "4 · Proyectos por tokens únicos del nombre", hint: "Tokens ≥5 chars exclusivos de un proyecto activo en nombre o asunto" },
            { key: "chunks", label: "5 · Propagar proyecto a document_chunks", hint: "Copia proyecto_id del documento a sus chunks" },
          ].map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-[11px] text-muted-foreground">{f.hint}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => runBackfill(f.key, true)} disabled={!!bfRunning}>
                  {bfRunning === f.key + ":dry" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FlaskConical className="h-3.5 w-3.5 mr-1" />} Simulacro
                </Button>
                <Button size="sm" onClick={() => runBackfill(f.key, false)} disabled={!!bfRunning}>
                  {bfRunning === f.key ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />} Ejecutar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
