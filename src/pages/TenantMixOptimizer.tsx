import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SynergyMatrix } from "@/components/SynergyMatrix";
import { PlanComparisonGrid } from "@/components/PlanComparisonGrid";
import { Layers, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TenantMixOptimizer() {
  const [centroNombre, setCentroNombre] = useState("");
  const [centroUbicacion, setCentroUbicacion] = useState("");
  const [localesRaw, setLocalesRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleOptimize = async () => {
    if (!centroNombre) { toast({ title: "Introduce el nombre del centro", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      let locales;
      try { locales = localesRaw ? JSON.parse(localesRaw) : undefined; } catch { locales = localesRaw; }
      const { data, error } = await supabase.functions.invoke("ai-tenant-mix-avanzado", {
        body: { centro_nombre: centroNombre, centro_ubicacion: centroUbicacion, locales_disponibles: locales },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast({ title: "Optimización completada", description: `${data.planes?.length || 0} planes generados` });
    } catch (e: any) {
      toast({ title: "Error en optimización", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Optimización de Tenant Mix</h1>
        <p className="text-sm text-muted-foreground">Capa 3 AVA TURING NEXUS — Genera planes A/B/C con sinergias entre operadores</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-accent" /> Configuración del Centro</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre del centro *</Label>
              <Input value={centroNombre} onChange={e => setCentroNombre(e.target.value)} placeholder="Centro Comercial Plaza Mayor" />
            </div>
            <div className="space-y-1.5">
              <Label>Ubicación</Label>
              <Input value={centroUbicacion} onChange={e => setCentroUbicacion(e.target.value)} placeholder="Madrid, zona norte" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Locales disponibles (opcional, JSON)</Label>
            <Textarea rows={4} value={localesRaw} onChange={e => setLocalesRaw(e.target.value)} className="font-mono text-sm" placeholder='[{"superficie_m2": 200, "planta": "baja"}, ...]' />
          </div>
          <Button onClick={handleOptimize} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? <><Clock className="mr-2 h-4 w-4 animate-spin" /> Optimizando...</> : <><Layers className="mr-2 h-4 w-4" /> Generar Planes A/B/C</>}
          </Button>
        </CardContent>
      </Card>

      {loading && <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}</div>}

      {result && !result.error && (
        <>
          <div>
            <h2 className="text-lg font-semibold mb-3">📊 Comparación de Planes</h2>
            <PlanComparisonGrid planes={result.planes || []} />
          </div>

          {result.sinergias_detectadas && result.sinergias_detectadas.length > 0 && (
            <Card>
              <CardHeader><CardTitle>🔗 Sinergias Detectadas</CardTitle></CardHeader>
              <CardContent>
                <SynergyMatrix sinergias={result.sinergias_detectadas} />
              </CardContent>
            </Card>
          )}

          {result.recomendacion_general && (
            <Card>
              <CardHeader><CardTitle>💡 Recomendación General</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed">{result.recomendacion_general}</p></CardContent>
            </Card>
          )}

          {result.latencia_ms && <p className="text-xs text-muted-foreground">⏱ Análisis completado en {result.latencia_ms}ms</p>}
        </>
      )}
    </div>
  );
}
