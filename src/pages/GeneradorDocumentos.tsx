import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hammer, Loader2, Save, CheckCircle2 } from "lucide-react";
import { generateForgeDocument, FORGE_MODES, ForgeMode } from "@/services/ragService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ForgePreview } from "@/components/forge/ForgePreview";
import { GeneradorHistorial } from "@/components/forge/GeneradorHistorial";
import { saveGeneratedDocument, type DocumentoGenerado } from "@/services/generadorHistoryService";

export default function GeneradorDocumentos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<ForgeMode>("dossier_operador");
  const [context, setContext] = useState("");
  const [structured, setStructured] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
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
    setStructured(null);
    setMeta(null);
    setSavedId(null);
    const proyectoId = selectedProyecto && selectedProyecto !== "none" ? selectedProyecto : undefined;
    const res = await generateForgeDocument(mode, context, proyectoId, "structured");
    if (res.error) {
      toast({ title: "Error FORGE", description: res.error, variant: "destructive" });
      setLoading(false);
      return;
    }
    if (!res.structured) {
      toast({ title: "Sin datos estructurados", description: "El modelo no devolvió la estructura esperada.", variant: "destructive" });
      setLoading(false);
      return;
    }

    setStructured(res.structured);
    setMeta({ model: res.model, latency_ms: res.latency_ms });
    setLoading(false);

    // Auto-guardado en histórico (no bloqueante)
    const modeInfo = FORGE_MODES.find(m => m.value === mode);
    setSaving(true);
    const { doc, error: saveError } = await saveGeneratedDocument({
      mode,
      modeLabel: modeInfo?.label || mode,
      contexto: context,
      structured: res.structured,
      proyectoId,
      modelo: res.model,
      latencyMs: res.latency_ms,
    });
    setSaving(false);

    if (saveError || !doc) {
      toast({
        title: "Generado, pero no guardado",
        description: saveError || "Revisa permisos. El documento sigue visible aquí pero no en el historial.",
        variant: "destructive",
      });
    } else {
      setSavedId(doc.id);
      qc.invalidateQueries({ queryKey: ["documentos-generados"] });
      toast({ title: "Documento generado y guardado", description: "Disponible en el Historial y en Documentos." });
    }
  };

  const handleOpenFromHistory = (doc: DocumentoGenerado) => {
    setMode(doc.mode as ForgeMode);
    setContext(doc.contexto || "");
    setStructured(doc.structured_data);
    setMeta({ model: doc.modelo || "", latency_ms: doc.latencia_ms || 0 });
    setSelectedProyecto(doc.proyecto_id || "none");
    setSavedId(doc.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const modeInfo = FORGE_MODES.find(m => m.value === mode);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Hammer className="h-6 w-6" /> Generador de Documentos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Plantillas profesionales con IA · Motor Gemini 3.1 Pro · Salida estructurada · Histórico automático
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {FORGE_MODES.map((m) => (
                <button key={m.value} onClick={() => { setMode(m.value); setStructured(null); setSavedId(null); }}
                  className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${mode === m.value ? "border-primary bg-primary/5" : "border-border"}`}>
                  <span className="text-lg">{m.icon}</span>
                  <p className="font-medium text-sm mt-1">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
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
              <div className="space-y-2 flex flex-col justify-end">
                {meta && (
                  <span className="text-xs text-muted-foreground">
                    Último: {meta.model} · {meta.latency_ms}ms
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contexto / Instrucciones</Label>
              <Textarea
                placeholder="Describe qué necesitas generar con el mayor contexto posible. Ej: 'Dossier completo del operador Grupo Vips para evaluar implantación en C.C. La Milla Arganda. Considera su ratio facturación/m², histórico de aperturas en parques de conveniencia y rango de renta aceptado.'"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={5}
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={handleGenerate} disabled={loading || !context.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hammer className="h-4 w-4 mr-2" />}
                Generar documento profesional
              </Button>
              {saving && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Save className="h-3 w-3 animate-pulse" /> Guardando en histórico…
                </span>
              )}
              {savedId && !saving && (
                <span className="text-xs text-accent flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Guardado en histórico
                </span>
              )}
            </div>

            {structured && modeInfo && (
              <div className="pt-4 border-t">
                <ForgePreview mode={mode} modeLabel={modeInfo.label} data={structured} />
              </div>
            )}

            {!structured && !loading && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Selecciona un tipo, proporciona contexto detallado y genera. La IA producirá un documento estructurado de calidad consultoría.
              </p>
            )}
          </CardContent>
        </Card>

        <GeneradorHistorial onOpenPreview={handleOpenFromHistory} />
      </div>
    </div>
  );
}
