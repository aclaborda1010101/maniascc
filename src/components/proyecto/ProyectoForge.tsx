import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Hammer, Loader2 } from "lucide-react";
import { generateForgeDocument, FORGE_MODES, ForgeMode } from "@/services/ragService";
import { useToast } from "@/hooks/use-toast";
import { ForgePreview } from "@/components/forge/ForgePreview";

interface Props {
  proyectoId: string;
}

export function ProyectoForge({ proyectoId }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<ForgeMode>("dossier_operador");
  const [context, setContext] = useState("");
  const [structured, setStructured] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ model: string; latency_ms: number } | null>(null);

  const handleGenerate = async () => {
    if (!context.trim()) return;
    setLoading(true);
    setStructured(null);
    setMeta(null);
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Hammer className="h-4 w-4" /> FORGE — Fábrica de Documentos IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
        <div className="space-y-2">
          <Label>Contexto / Instrucciones</Label>
          <Textarea
            placeholder="Describe qué necesitas generar con el mayor contexto posible..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleGenerate} disabled={loading || !context.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hammer className="h-4 w-4 mr-2" />}
            Generar documento
          </Button>
          {meta && <span className="text-xs text-muted-foreground">{meta.model} · {meta.latency_ms}ms</span>}
        </div>

        {structured && modeInfo && (
          <div className="pt-4 border-t">
            <ForgePreview mode={mode} modeLabel={modeInfo.label} data={structured} />
          </div>
        )}

        {!structured && !loading && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Selecciona un tipo, proporciona contexto y genera.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
