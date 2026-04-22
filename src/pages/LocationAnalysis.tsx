import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScoreGauge } from "@/components/ScoreGauge";
import { MapPin, Compass, Clock, AlertTriangle, Lightbulb, Search, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LocationAnalysis() {
  const [direccion, setDireccion] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radio, setRadio] = useState("5");
  const [tipoCentro, setTipoCentro] = useState("centro_comercial");
  const [presupuesto, setPresupuesto] = useState("");
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [coordsOpen, setCoordsOpen] = useState(false);
  const { toast } = useToast();

  const geocodeAddress = async (address: string): Promise<{ lat: number; lon: number } | null> => {
    try {
      setGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        { headers: { "Accept-Language": "es" } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
      return null;
    } catch {
      return null;
    } finally {
      setGeocoding(false);
    }
  };

  const handleAnalyze = async () => {
    let finalLat = lat ? parseFloat(lat) : NaN;
    let finalLon = lon ? parseFloat(lon) : NaN;

    // If address provided, geocode it
    if (direccion.trim()) {
      const coords = await geocodeAddress(direccion.trim());
      if (coords) {
        finalLat = coords.lat;
        finalLon = coords.lon;
        setLat(String(coords.lat));
        setLon(String(coords.lon));
      } else {
        toast({ title: "No se pudo localizar la dirección", description: "Introduce coordenadas manualmente o prueba otra dirección", variant: "destructive" });
        return;
      }
    }

    if (isNaN(finalLat) || isNaN(finalLon)) {
      toast({ title: "Introduce una dirección o coordenadas", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-localizacion-patrones", {
        body: {
          coordenadas_lat: finalLat,
          coordenadas_lon: finalLon,
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
        <p className="text-sm text-muted-foreground">Análisis de viabilidad con IA para ubicaciones de centros comerciales</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Compass className="h-5 w-5 text-accent" /> Parámetros de Análisis</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Primary: Address */}
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Ej: Calle Gran Vía 32, Madrid"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Escribe una dirección y la geocodificaremos automáticamente</p>
          </div>

          {/* Collapsible advanced coords */}
          <Collapsible open={coordsOpen} onOpenChange={setCoordsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1 px-0">
                <ChevronDown className={`h-3 w-3 transition-transform ${coordsOpen ? "rotate-180" : ""}`} />
                Coordenadas avanzadas (opcional)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Latitud</Label>
                  <Input placeholder="40.4168" value={lat} onChange={e => setLat(e.target.value)} type="number" step="any" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Longitud</Label>
                  <Input placeholder="-3.7038" value={lon} onChange={e => setLon(e.target.value)} type="number" step="any" />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Other params */}
          <div className="grid gap-4 sm:grid-cols-3">
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

          <Button onClick={handleAnalyze} disabled={loading || geocoding} className="bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md">
            {loading || geocoding
              ? <><Clock className="mr-2 h-4 w-4 animate-spin" /> {geocoding ? "Localizando..." : "Analizando..."}</>
              : <><Search className="mr-2 h-4 w-4" /> Analizar Localización</>}
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
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="md:col-span-1">
              <CardContent className="pt-6 flex flex-col items-center">
                <ScoreGauge score={result.score_viabilidad} label="Score Viabilidad" size="lg" />
                <Badge variant="secondary" className="mt-2">Confianza: {result.confianza}%</Badge>
                {result.latencia_ms && <p className="text-xs text-muted-foreground mt-1">⏱ {result.latencia_ms}ms</p>}
              </CardContent>
            </Card>
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

          {result.recomendacion && (
            <Card>
              <CardHeader><CardTitle>💡 Recomendación AVA</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed">{result.recomendacion}</p></CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
