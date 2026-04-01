import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SynergyMatrix } from "@/components/SynergyMatrix";
import { PlanComparisonGrid } from "@/components/PlanComparisonGrid";
import { Layers, Clock, Plus, X, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LocalItem {
  superficie_m2: string;
  planta: string;
  estado: string;
  operador_actual: string;
}

const emptyLocal = (): LocalItem => ({ superficie_m2: "", planta: "baja", estado: "disponible", operador_actual: "" });

export default function TenantMixOptimizer() {
  const [centroNombre, setCentroNombre] = useState("");
  const [centroUbicacion, setCentroUbicacion] = useState("");
  const [locales, setLocales] = useState<LocalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const addLocal = () => setLocales([...locales, emptyLocal()]);
  const removeLocal = (i: number) => setLocales(locales.filter((_, idx) => idx !== i));
  const updateLocal = (i: number, field: keyof LocalItem, val: string) => {
    const updated = [...locales];
    updated[i] = { ...updated[i], [field]: val };
    setLocales(updated);
  };

  const handleOptimize = async () => {
    if (!centroNombre) { toast({ title: "Introduce el nombre del centro", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const localesPayload = locales
        .filter(l => l.superficie_m2)
        .map(l => ({
          superficie_m2: parseFloat(l.superficie_m2),
          planta: l.planta,
          estado: l.estado,
          operador_actual: l.operador_actual || undefined,
        }));

      const { data, error } = await supabase.functions.invoke("ai-tenant-mix-avanzado", {
        body: {
          centro_nombre: centroNombre,
          centro_ubicacion: centroUbicacion,
          locales_disponibles: localesPayload.length > 0 ? localesPayload : undefined,
        },
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
        <p className="text-sm text-muted-foreground">Genera planes A/B/C con sinergias entre operadores</p>
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

          {/* Locales builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Building2 className="h-4 w-4" /> Locales disponibles
              </Label>
              <Button variant="outline" size="sm" onClick={addLocal} className="gap-1">
                <Plus className="h-3 w-3" /> Añadir local
              </Button>
            </div>

            {locales.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No hay locales añadidos. Pulsa "Añadir local" para incluir información de los espacios disponibles.</p>
            )}

            {locales.map((local, i) => (
              <div key={i} className="flex gap-2 items-end rounded-lg border p-3 bg-muted/20">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Superficie m²</Label>
                  <Input type="number" placeholder="200" value={local.superficie_m2} onChange={e => updateLocal(i, "superficie_m2", e.target.value)} />
                </div>
                <div className="w-32 space-y-1">
                  <Label className="text-xs">Planta</Label>
                  <Select value={local.planta} onValueChange={v => updateLocal(i, "planta", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sotano">Sótano</SelectItem>
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="primera">Primera</SelectItem>
                      <SelectItem value="segunda">Segunda</SelectItem>
                      <SelectItem value="tercera">Tercera</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32 space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Select value={local.estado} onValueChange={v => updateLocal(i, "estado", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disponible">Disponible</SelectItem>
                      <SelectItem value="ocupado">Ocupado</SelectItem>
                      <SelectItem value="en_reforma">En reforma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Operador actual</Label>
                  <Input placeholder="Opcional" value={local.operador_actual} onChange={e => updateLocal(i, "operador_actual", e.target.value)} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeLocal(i)} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
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
