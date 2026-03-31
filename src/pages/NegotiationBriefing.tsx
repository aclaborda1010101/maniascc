import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NegotiatorCard } from "@/components/NegotiatorCard";
import { UserCircle, Clock, History, MessageSquare, Shield, XCircle, CheckCircle, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryExpertForge, EXPERT_SPECIALISTS } from "@/services/expertForge";

export default function NegotiationBriefing() {
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [contexto, setContexto] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const { toast } = useToast();

  // Expert Forge MoE state
  const [efQuestion, setEfQuestion] = useState("");
  const [efAnswer, setEfAnswer] = useState<any>(null);
  const [efLoading, setEfLoading] = useState(false);

  useEffect(() => {
    supabase.from("negociaciones_historico").select("*").order("creado_en", { ascending: false }).limit(20)
      .then(({ data }) => setHistorico(data || []));
  }, []);

  const handleGenerate = async () => {
    if (!nombre) { toast({ title: "Introduce el nombre del contacto", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-perfil-negociador", {
        body: { contacto_nombre: nombre, contacto_empresa: empresa, contacto_cargo: cargo, contexto_deal: contexto, notas_previas: notas },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast({ title: "Briefing generado", description: `Estilo: ${data.estilo_primario}` });
    } catch (e: any) {
      toast({ title: "Error en briefing", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Briefing de Negociación</h1>
        <p className="text-sm text-muted-foreground">Capa 4 AVA TURING PULSE — Perfiles psicológicos y recomendaciones tácticas pre-reunión</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5 text-accent" /> Datos del Interlocutor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan García" />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Inmobiliaria XYZ" />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Director Comercial" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Contexto del deal</Label>
            <Textarea rows={3} value={contexto} onChange={e => setContexto(e.target.value)} placeholder="Local de 500m² en centro comercial X, renta pedida 25€/m²..." />
          </div>
          <div className="space-y-1.5">
            <Label>Notas previas</Label>
            <Textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas de reuniones anteriores..." />
          </div>
          <Button onClick={handleGenerate} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? <><Clock className="mr-2 h-4 w-4 animate-spin" /> Generando...</> : <><MessageSquare className="mr-2 h-4 w-4" /> Generar Briefing</>}
          </Button>
        </CardContent>
      </Card>

      {loading && <Skeleton className="h-64 w-full rounded-xl" />}

      {result && !result.error && (
        <>
          <NegotiatorCard
            nombre={nombre}
            empresa={empresa}
            cargo={cargo}
            estilo_primario={result.estilo_primario}
            estilo_secundario={result.estilo_secundario}
            fortalezas={result.fortalezas}
            debilidades={result.debilidades}
            probabilidad_cierre={result.probabilidad_cierre}
            formato_preferido={result.formato_preferido}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-chart-2">✅ Talking Points</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {(result.talking_points || []).map((t: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle className="h-4 w-4 text-chart-2 shrink-0 mt-0.5" />{t}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-destructive">❌ Qué Evitar</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {(result.que_evitar || []).map((q: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm"><XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />{q}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {result.recomendacion_apertura && (
            <Card>
              <CardHeader><CardTitle>🎯 Recomendación de Apertura</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed italic">"{result.recomendacion_apertura}"</p></CardContent>
            </Card>
          )}

          {result.puntos_flexion && result.puntos_flexion.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Puntos de Flexión</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.puntos_flexion.map((p: any, i: number) => (
                    <Badge key={i} variant="secondary">{p.punto} <span className="ml-1 text-muted-foreground">({p.importancia})</span></Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.latencia_ms && <p className="text-xs text-muted-foreground">⏱ Briefing generado en {result.latencia_ms}ms</p>}
        </>
      )}

      {/* Historical negotiations */}
      {historico.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Historial de Negociaciones</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negociador</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Días</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.negociador_interno}</TableCell>
                    <TableCell>{h.activo_ref || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={h.resultado === "exito" ? "default" : h.resultado === "fracaso" ? "destructive" : "secondary"}>
                        {h.resultado}
                      </Badge>
                    </TableCell>
                    <TableCell>{h.duracion_dias || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(h.creado_en).toLocaleDateString("es-ES")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
