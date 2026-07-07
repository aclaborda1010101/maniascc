import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Shield, CheckCircle, Mail, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Admin() {
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [filterFuncion, setFilterFuncion] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [m365Stats, setM365Stats] = useState<{ pending: number; needs_review: number; applied: number; discarded: number; error: number; last_synced: string | null; umbral: number }>({ pending: 0, needs_review: 0, applied: 0, discarded: 0, error: 0, last_synced: null, umbral: 0.8 });
  const [m365Loading, setM365Loading] = useState(false);
  const [m365Syncing, setM365Syncing] = useState(false);

  useEffect(() => { fetchLogs(); fetchM365(); }, []);

  const fetchLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase.from("auditoria_ia").select("*").order("created_at", { ascending: false }).limit(200);
    setLogs(data || []);
    setLogsLoading(false);
  };

  const fetchM365 = async () => {
    setM365Loading(true);
    const [{ data: rows }, { data: sync }, { data: settings }] = await Promise.all([
      supabase.from("email_ingest_queue").select("status"),
      supabase.from("sync_state").select("last_synced_at").eq("channel", "m365_journal").maybeSingle(),
      supabase.from("email_classifier_settings").select("umbral_auto").limit(1).maybeSingle(),
    ]);
    const counts = { pending: 0, needs_review: 0, applied: 0, discarded: 0, error: 0 };
    (rows || []).forEach((r: any) => { if (counts[r.status as keyof typeof counts] !== undefined) counts[r.status as keyof typeof counts]++; });
    setM365Stats({ ...counts, last_synced: sync?.last_synced_at || null, umbral: Number(settings?.umbral_auto ?? 0.8) });
    setM365Loading(false);
  };

  const syncNow = async () => {
    setM365Syncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("m365-journal-sync", { body: {} });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      toast({ title: "Sincronizado", description: `${d?.inserted ?? 0} nuevos, ${d?.discarded ?? 0} descartados` });
      fetchM365();
    } catch (e: any) {
      toast({ title: "Error de sync", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setM365Syncing(false);
    }
  };

  const updateUmbral = async (v: number) => {
    if (isNaN(v) || v < 0 || v > 1) return;
    const { data: row } = await supabase.from("email_classifier_settings").select("id").limit(1).maybeSingle();
    if (row) {
      await supabase.from("email_classifier_settings").update({ umbral_auto: v, updated_at: new Date().toISOString() }).eq("id", row.id);
      setM365Stats((s) => ({ ...s, umbral: v }));
      toast({ title: "Umbral actualizado", description: `${Math.round(v * 100)}%` });
    }
  };


  const filteredLogs = logs.filter(l => {
    if (filterFuncion !== "all" && l.funcion_ia !== filterFuncion) return false;
    if (filterDateFrom && new Date(l.created_at) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(l.created_at) > new Date(filterDateTo + "T23:59:59")) return false;
    return true;
  });

  const avgLatency = filteredLogs.length > 0 ? Math.round(filteredLogs.reduce((sum, l) => sum + (Number(l.latencia_ms) || 0), 0) / filteredLogs.length) : 0;
  const funciones = [...new Set(logs.map(l => l.funcion_ia).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" /> Administración
        </h1>
        <p className="text-sm text-muted-foreground">Auditoría y configuración del sistema</p>
      </div>

      <Tabs defaultValue="auditoria">
        <TabsList>
          <TabsTrigger value="auditoria" className="gap-1"><Shield className="h-3 w-3" /> Auditoría</TabsTrigger>
          <TabsTrigger value="config" className="gap-1"><Settings className="h-3 w-3" /> Configuración</TabsTrigger>
        </TabsList>

        {/* Tab: Auditoría */}
        <TabsContent value="auditoria" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Operaciones</p><p className="text-2xl font-bold">{filteredLogs.length}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Tasa de éxito</p><p className="text-2xl font-bold">{filteredLogs.length > 0 ? Math.round((filteredLogs.filter(l => l.exito).length / filteredLogs.length) * 100) : 0}%</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Latencia media</p><p className="text-2xl font-bold">{avgLatency}ms</p></CardContent></Card>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Función</Label>
              <Select value={filterFuncion} onValueChange={setFilterFuncion}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {funciones.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-40" /></div>
            <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-40" /></div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Operaciones</CardTitle></CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-12 text-center"><Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="text-muted-foreground">No hay operaciones registradas.</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Función</TableHead><TableHead>Modelo</TableHead><TableHead>Latencia</TableHead><TableHead>Tokens</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredLogs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.funcion_ia || "—"}</TableCell>
                        <TableCell className="text-xs">{l.modelo}</TableCell>
                        <TableCell>{l.latencia_ms ? `${l.latencia_ms}ms` : "—"}</TableCell>
                        <TableCell className="text-xs">{l.tokens_entrada || 0} → {l.tokens_salida || 0}</TableCell>
                        <TableCell><Badge variant="secondary" className={l.exito ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}>{l.exito ? "OK" : "Error"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("es-ES")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Configuración */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Arquitectura AVA</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label className="text-xs text-muted-foreground">Orquestador</Label><p className="text-sm font-mono mt-1">ava-orchestrator</p></div>
                <div><Label className="text-xs text-muted-foreground">RAG interno</Label><p className="text-sm font-mono mt-1">rag-proxy + document_chunks</p></div>
                <div><Label className="text-xs text-muted-foreground">Gateway IA</Label><p className="text-sm font-mono mt-1">Lovable AI Gateway</p></div>
                <div><Label className="text-xs text-muted-foreground">Modelo principal</Label><p className="text-sm font-mono mt-1">google/gemini-2.5-flash</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Funciones de Inteligencia</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { name: "Localización", fn: "ai-localizacion-patrones" },
                  { name: "Tenant Mix", fn: "ai-tenant-mix-avanzado" },
                  { name: "Validación Dossier", fn: "ai-validacion-retorno" },
                  { name: "Perfil Negociador", fn: "ai-perfil-negociador" },
                  { name: "Forge Documentos", fn: "ai-forge" },
                  { name: "Clasificación Documental", fn: "document-classify" },
                  { name: "RAG Ingest", fn: "rag-ingest" },
                  { name: "RAG Proxy", fn: "rag-proxy" },
                ].map(f => (
                  <div key={f.fn} className="rounded-lg border p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{f.fn}</p>
                    </div>
                    <CheckCircle className="h-4 w-4 text-chart-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Correo M365</CardTitle>
                <Button size="sm" onClick={syncNow} disabled={m365Syncing}>
                  {m365Syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                  Sincronizar ahora
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {m365Loading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-5">
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Pendientes</p><p className="text-xl font-bold">{m365Stats.pending}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Revisión</p><p className="text-xl font-bold text-chart-4">{m365Stats.needs_review}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Aplicados</p><p className="text-xl font-bold text-chart-2">{m365Stats.applied}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Descartados</p><p className="text-xl font-bold">{m365Stats.discarded}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Errores</p><p className="text-xl font-bold text-destructive">{m365Stats.error}</p></div>
                  </div>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Último sync</Label>
                      <p className="text-sm font-mono">{m365Stats.last_synced ? new Date(m365Stats.last_synced).toLocaleString("es-ES") : "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Umbral auto (0–1)</Label>
                      <Input type="number" min={0} max={1} step={0.05} defaultValue={m365Stats.umbral} onBlur={(e) => updateUmbral(Number(e.target.value))} className="w-32" />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
