import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hammer, Loader2 } from "lucide-react";
import { generateForgeDocument, FORGE_MODES, ForgeMode } from "@/services/ragService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ForgePreview } from "@/components/forge/ForgePreview";

export default function GeneradorDocumentos() {
  const { toast } = useToast();
  const [mode, setMode] = useState<ForgeMode>("dossier_operador");
  const [context, setContext] = useState("");
  const [structured, setStructured] = useState<any>(null);
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
    setStructured(null);
    setMeta(null);
    const proyectoId = selectedProyecto && selectedProyecto !== "none" ? selectedProyecto : undefined;
    const res = await generateForgeDocument(mode, context, proyectoId, "structured");
    if (res.error) {
      toast({ title: "Error FORGE", description: res.error, variant: "destructive" });
    } else if (!res.structured) {
      toast({ title: "Sin datos estructurados", description: "El modelo no devolvió la estructura esperada.", variant: "destructive" });
    } else {
      setStructured(res.structured);
      setMeta({ model: res.model, latency_ms: res.latency_ms });
    }
    setLoading(false);
  };

  const modeInfo = FORGE_MODES.find(m => m.value === mode);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Hammer className="h-6 w-6" /> Generador de Documentos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Plantillas profesionales con IA · Motor Gemini 3.1 Pro · Salida estructurada
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {FORGE_MODES.map((m) => (
              <button key={m.value} onClick={() => { setMode(m.value); setStructured(null); }}
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

          <div className="flex items-center gap-3">
            <Button onClick={handleGenerate} disabled={loading || !context.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hammer className="h-4 w-4 mr-2" />}
              Generar documento profesional
            </Button>
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
    </div>
  );
}
