import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ScoreGauge";
import { TrafficLight } from "@/components/TrafficLight";
import { FileSearch, Clock, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DossierValidation() {
  const [tipoActivo, setTipoActivo] = useState("centro_comercial");
  const [ubicacion, setUbicacion] = useState("");
  const [cp, setCp] = useState("");
  const [propietario, setPropietario] = useState("");
  const [metricasRaw, setMetricasRaw] = useState('{\n  "rentabilidad_declarada": 8.5,\n  "tasa_ocupacion": 95,\n  "precio_m2_renta": 22,\n  "estimacion_trafico_diario": 15000,\n  "capex_estimado_m2": 800\n}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleValidate = async () => {
    let metricas;
    try { metricas = JSON.parse(metricasRaw); } catch { toast({ title: "JSON inválido en métricas", variant: "destructive" }); return; }

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
        <p className="text-sm text-muted-foreground">Capa 2 ATLAS RADAR — Detecta métricas infladas en dossiers de propietarios</p>
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

          <div className="space-y-1.5">
            <Label>Métricas declaradas (JSON)</Label>
            <Textarea rows={7} value={metricasRaw} onChange={e => setMetricasRaw(e.target.value)} className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">Introduce las métricas del dossier en formato JSON.</p>
          </div>

          <Button onClick={handleValidate} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
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
