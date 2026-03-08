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
import { MapPin, Compass, Clock, AlertTriangle, Lightbulb, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LocationAnalysis() {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radio, setRadio] = useState("5");
  const [tipoCentro, setTipoCentro] = useState("centro_comercial");
  const [presupuesto, setPresupuesto] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!lat || !lon) { toast({ title: "Introduce las coordenadas", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-localizacion-patrones", {
        body: {
          coordenadas_lat: parseFloat(lat),
          coordenadas_lon: parseFloat(lon),
          radio_km: parseFloat(radio),
          tipo_centro: tipoCentro,
          presupuesto_estimado: presupuesto ? parseFloat(presupuesto) : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast({ title: "Análisis completado", description: `Score de viabilidad: ${data.score_viabilidad}/100` });
    } catch (e: any) {
      toast({ title: "Error en análisis", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const desglose = result?.desglose_variables;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inteligencia de Localización</h1>
        <p className="text-sm text-muted-foreground">Capa 1 ATLAS — Análisis de viabilidad con IA para ubicaciones de centros comerciales</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Compass className="h-5 w-5 text-accent" /> Parámetros de Análisis</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Latitud *</Label>
              <Input placeholder="40.4168" value={lat} onChange={e => setLat(e.target.value)} type="number" step="any" />
            </div>
            <div className="space-y-1.5">
              <Label>Longitud *</Label>
              <Input placeholder="-3.7038" value={lon} onChange={e => setLon(e.target.value)} type="number" step="any" />
            </div>
            <div className="space-y-1.5">
              <Label>Radio (km)</Label>
              <Input value={radio} onChange={e => setRadio(e.target.value)} type="number" min={1} max={50} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de centro</Label>
              <Select value={tipoCentro} onValueChange={setTipoCentro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="centro_comercial">Centro Comercial</SelectItem>
                  <SelectItem value="parque_medianas">Parque de Medianas</SelectItem>
                  <SelectItem value="high_street">High Street</SelectItem>
                  <SelectItem value="retail_park">Retail Park</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Presupuesto (€)</Label>
              <Input value={presupuesto} onChange={e => setPresupuesto(e.target.value)} type="number" placeholder="Opcional" />
            </div>
          </div>
          <Button onClick={handleAnalyze} disabled={loading} className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? <><Clock className="mr-2 h-4 w-4 animate-spin" /> Analizando...</> : <><Search className="mr-2 h-4 w-4" /> Analizar Localización</>}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      )}

      {result && !result.error && (
        <>
          {/* Main Score */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="md:col-span-1">
              <CardContent className="pt-6 flex flex-col items-center">
                <ScoreGauge score={result.score_viabilidad} label="Score Viabilidad" size="lg" />
                <Badge variant="secondary" className="mt-2">Confianza: {result.confianza}%</Badge>
                {result.latencia_ms && <p className="text-xs text-muted-foreground mt-1">⏱ {result.latencia_ms}ms</p>}
              </CardContent>
            </Card>

            {/* Breakdown */}
            <Card className="md:col-span-3">
              <CardHeader><CardTitle>Desglose por Dimensión</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {desglose && Object.entries(desglose).map(([key, val]: [string, any]) => (
                    <div key={key} className="rounded-lg border p-3 text-center">
                      <ScoreGauge score={val.score} size="sm" />
                      <p className="text-xs font-medium mt-1 capitalize">{key}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{val.detalle}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risks and Opportunities */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Riesgos</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(result.riesgos || []).map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-destructive/5 p-2">
                    <Badge variant="outline" className="text-destructive border-destructive/30 shrink-0">{r.nivel}</Badge>
                    <p className="text-sm">{r.descripcion}</p>
                  </div>
                ))}
                {(!result.riesgos || result.riesgos.length === 0) && <p className="text-sm text-muted-foreground">Sin riesgos identificados</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-chart-2"><Lightbulb className="h-4 w-4" /> Oportunidades</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(result.oportunidades || []).map((o: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-chart-2/5 p-2">
                    <Badge variant="outline" className="text-chart-2 border-chart-2/30 shrink-0">{o.impacto}</Badge>
                    <p className="text-sm">{o.descripcion}</p>
                  </div>
                ))}
                {(!result.oportunidades || result.oportunidades.length === 0) && <p className="text-sm text-muted-foreground">Sin oportunidades detectadas</p>}
              </CardContent>
            </Card>
          </div>

          {/* Recommendation */}
          {result.recomendacion && (
            <Card>
              <CardHeader><CardTitle>💡 Recomendación ATLAS</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed">{result.recomendacion}</p></CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
