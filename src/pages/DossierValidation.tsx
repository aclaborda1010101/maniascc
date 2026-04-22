import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ScoreGauge";
import { TrafficLight } from "@/components/TrafficLight";
import { FileSearch, Clock, BookOpen, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExtraMetric {
  key: string;
  value: string;
}

export default function DossierValidation() {
  const [tipoActivo, setTipoActivo] = useState("centro_comercial");
  const [ubicacion, setUbicacion] = useState("");
  const [cp, setCp] = useState("");
  const [propietario, setPropietario] = useState("");
  // Individual metric fields
  const [rentabilidad, setRentabilidad] = useState("");
  const [tasaOcupacion, setTasaOcupacion] = useState("");
  const [precioM2, setPrecioM2] = useState("");
  const [traficoDiario, setTraficoDiario] = useState("");
  const [capexM2, setCapexM2] = useState("");
  const [extraMetrics, setExtraMetrics] = useState<ExtraMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const addExtraMetric = () => setExtraMetrics([...extraMetrics, { key: "", value: "" }]);
  const removeExtraMetric = (i: number) => setExtraMetrics(extraMetrics.filter((_, idx) => idx !== i));
  const updateExtraMetric = (i: number, field: "key" | "value", val: string) => {
    const updated = [...extraMetrics];
    updated[i][field] = val;
    setExtraMetrics(updated);
  };

  const buildMetricas = () => {
    const m: Record<string, number> = {};
    if (rentabilidad) m.rentabilidad_declarada = parseFloat(rentabilidad);
    if (tasaOcupacion) m.tasa_ocupacion = parseFloat(tasaOcupacion);
    if (precioM2) m.precio_m2_renta = parseFloat(precioM2);
    if (traficoDiario) m.estimacion_trafico_diario = parseFloat(traficoDiario);
    if (capexM2) m.capex_estimado_m2 = parseFloat(capexM2);
    extraMetrics.forEach(em => {
      if (em.key && em.value) m[em.key] = parseFloat(em.value) || 0;
    });
    return m;
  };

  const handleValidate = async () => {
    const metricas = buildMetricas();
    if (Object.keys(metricas).length === 0) {
      toast({ title: "Introduce al menos una métrica", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-validacion-retorno", {
        body: { metricas_declaradas: metricas, tipo_activo: tipoActivo, ubicacion, codigo_postal: cp, propietario_ref: propietario },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast({ title: "Validación completada", description: `Confianza global: ${data.confianza_global}%` });
    } catch (e: any) {
      toast({ title: "Error en validación", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Validación de Dossier</h1>
        <p className="text-sm text-muted-foreground">Detecta métricas infladas en dossiers de propietarios</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileSearch className="h-5 w-5 text-accent" /> Datos del Dossier</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Tipo de activo</Label>
              <Select value={tipoActivo} onValueChange={setTipoActivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="centro_comercial">Centro Comercial</SelectItem>
                  <SelectItem value="parque_medianas">Parque de Medianas</SelectItem>
                  <SelectItem value="local_individual">Local Individual</SelectItem>
                  <SelectItem value="edificio_retail">Edificio Retail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ubicación</Label>
              <Input value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Madrid centro" />
            </div>
            <div className="space-y-1.5">
              <Label>Código Postal</Label>
              <Input value={cp} onChange={e => setCp(e.target.value)} placeholder="28001" />
            </div>
            <div className="space-y-1.5">
              <Label>Propietario</Label>
              <Input value={propietario} onChange={e => setPropietario(e.target.value)} placeholder="Nombre / empresa" />
            </div>
          </div>

          {/* Metrics - Individual inputs */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Métricas declaradas</Label>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Rentabilidad (%)</Label>
                <Input type="number" step="0.1" placeholder="8.5" value={rentabilidad} onChange={e => setRentabilidad(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tasa de ocupación (%)</Label>
                <Input type="number" step="0.1" placeholder="95" value={tasaOcupacion} onChange={e => setTasaOcupacion(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Precio renta m² (€/m²)</Label>
                <Input type="number" step="0.1" placeholder="22" value={precioM2} onChange={e => setPrecioM2(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tráfico diario</Label>
                <Input type="number" placeholder="15000" value={traficoDiario} onChange={e => setTraficoDiario(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">CAPEX est. m² (€)</Label>
                <Input type="number" placeholder="800" value={capexM2} onChange={e => setCapexM2(e.target.value)} />
              </div>
            </div>

            {/* Extra dynamic metrics */}
            {extraMetrics.map((em, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Nombre métrica</Label>
                  <Input placeholder="Ej: ingresos_anuales" value={em.key} onChange={e => updateExtraMetric(i, "key", e.target.value)} />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <Input type="number" placeholder="0" value={em.value} onChange={e => updateExtraMetric(i, "value", e.target.value)} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeExtraMetric(i)} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addExtraMetric} className="gap-1">
              <Plus className="h-3 w-3" /> Añadir más métricas
            </Button>
          </div>

          <Button onClick={handleValidate} disabled={loading} className="w-full sm:w-auto h-11 bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md">
            {loading ? <><Clock className="mr-2 h-4 w-4 animate-spin" /> Validando...</> : <><FileSearch className="mr-2 h-4 w-4" /> Validar Dossier</>}
          </Button>
        </CardContent>
      </Card>

      {loading && <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>}

      {result && !result.error && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center">
                <ScoreGauge score={result.confianza_global} label="Confianza Global" size="lg" />
                {result.latencia_ms && <p className="text-xs text-muted-foreground mt-2">⏱ {result.latencia_ms}ms</p>}
              </CardContent>
            </Card>
            <Card className="md:col-span-3">
              <CardHeader><CardTitle>🚦 Semáforos por Métrica</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.semaforos && Object.entries(result.semaforos).map(([key, val]: [string, any]) => (
                  <TrafficLight
                    key={key}
                    color={val.color}
                    label={key.replace(/_/g, " ")}
                    detail={`${val.explicacion || ""}${val.desviacion_pct ? ` (Desviación: ${val.desviacion_pct}%)` : ""}${val.benchmark_mercado ? ` — Benchmark: ${val.benchmark_mercado}` : ""}`}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {result.veredicto && (
            <Card>
              <CardHeader><CardTitle>📋 Veredicto</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed">{result.veredicto}</p></CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {result.recomendaciones && result.recomendaciones.length > 0 && (
              <Card>
                <CardHeader><CardTitle>💡 Recomendaciones</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {result.recomendaciones.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm"><span className="text-accent">→</span> {r}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {result.benchmarks_usados && result.benchmarks_usados.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Benchmarks Usados</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {result.benchmarks_usados.map((b: any, i: number) => (
                      <li key={i} className="text-sm"><Badge variant="outline" className="mr-2">{b.fuente}</Badge>{b.dato}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
