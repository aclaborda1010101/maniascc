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
import { Settings, Shield, CheckCircle, Mail, RefreshCw, Loader2, Plug, Save, Database, Play, FlaskConical } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

export default function Admin() {
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [filterFuncion, setFilterFuncion] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [m365Stats, setM365Stats] = useState<{ pending: number; needs_review: number; applied: number; discarded: number; error: number; last_synced: string | null; umbralAuto: number; umbralRev: number }>({ pending: 0, needs_review: 0, applied: 0, discarded: 0, error: 0, last_synced: null, umbralAuto: 0.85, umbralRev: 0.60 });
  const [m365Loading, setM365Loading] = useState(false);
  const [m365Syncing, setM365Syncing] = useState(false);
  const [m365Testing, setM365Testing] = useState(false);
  const [m365Saving, setM365Saving] = useState(false);

  // M365 config form
  const [cfg, setCfg] = useState({
    id: null as string | null,
    tenant_id: "",
    client_id: "",
    client_secret: "",
    client_secret_masked: "",
    journal_mailbox: "",
    connected: false,
    last_test_at: null as string | null,
    last_test_result: null as string | null,
  });
  const [secretChanged, setSecretChanged] = useState(false);

  // Reclasificación archivo
  const [bfStatus, setBfStatus] = useState<any>(null);
  const [bfLoading, setBfLoading] = useState(false);
  const [bfRunning, setBfRunning] = useState<string | null>(null);
  const [bfProgress, setBfProgress] = useState<{ phase: string; processed: number; linked: number; remaining: number } | null>(null);

  useEffect(() => { fetchLogs(); fetchM365(); loadCfg(); fetchBfStatus(); }, []);

  const fetchBfStatus = async () => {
    setBfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("rag-backfill-links", { body: { phase: "status" } });
      if (error) throw error;
      setBfStatus(data);
    } catch (e: any) {
      toast({ title: "Error status", description: e.message, variant: "destructive" });
    } finally { setBfLoading(false); }
  };

  const runBackfill = async (phase: string, dryRun: boolean) => {
    if (!dryRun && !confirm(`Ejecutar la fase "${phase}"? Rellenará vínculos vacíos (reversible por fase).`)) return;
    setBfRunning(phase + (dryRun ? ":dry" : ""));
    setBfProgress({ phase, processed: 0, linked: 0, remaining: 0 });
    try {
      let totalProc = 0, totalLinked = 0;
      // dry-run: una sola llamada; ejecución real: iterar hasta done
      for (let i = 0; i < 200; i++) {
        const { data, error } = await supabase.functions.invoke("rag-backfill-links", { body: { phase, dry_run: dryRun, batch_size: 1000 } });
        if (error) throw error;
        totalProc += data.processed || 0;
        totalLinked += data.linked || 0;
        setBfProgress({ phase, processed: totalProc, linked: totalLinked, remaining: data.remaining || 0 });
        if (dryRun || data.done) break;
      }
      toast({ title: dryRun ? "Simulacro" : "Fase completa", description: `${phase}: ${totalLinked} vínculos ${dryRun ? "vinculables" : "creados"}` });
      await fetchBfStatus();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBfRunning(null);
      setBfProgress(null);
    }
  };


  const fetchLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase.from("auditoria_ia").select("*").order("created_at", { ascending: false }).limit(200);
    setLogs(data || []);
    setLogsLoading(false);
  };

  const loadCfg = async () => {
    const { data } = await supabase.from("email_classifier_settings").select("*").limit(1).maybeSingle();
    if (data) {
      const sec = (data.m365_client_secret || "") as string;
      const masked = sec ? `••••${sec.slice(-4)}` : "";
      setCfg({
        id: data.id,
        tenant_id: data.m365_tenant_id || "",
        client_id: data.m365_client_id || "",
        client_secret: "",
        client_secret_masked: masked,
        journal_mailbox: data.m365_journal_mailbox || "",
        connected: !!data.m365_connected,
        last_test_at: data.m365_last_test_at,
        last_test_result: data.m365_last_test_result,
      });
      setM365Stats((s) => ({ ...s, umbralAuto: Number(data.umbral_auto ?? 0.85), umbralRev: Number(data.umbral_revision ?? 0.60) }));
    }
  };

  const fetchM365 = async () => {
    setM365Loading(true);
    const [{ data: rows }, { data: sync }] = await Promise.all([
      supabase.from("email_ingest_queue").select("status"),
      supabase.from("sync_state").select("last_synced_at").eq("channel", "m365_journal").maybeSingle(),
    ]);
    const counts = { pending: 0, needs_review: 0, applied: 0, discarded: 0, error: 0 };
    (rows || []).forEach((r: any) => { if (counts[r.status as keyof typeof counts] !== undefined) counts[r.status as keyof typeof counts]++; });
    setM365Stats((s) => ({ ...s, ...counts, last_synced: sync?.last_synced_at || null }));
    setM365Loading(false);
  };

  const saveCfg = async () => {
    setM365Saving(true);
    try {
      const update: any = {
        m365_tenant_id: cfg.tenant_id.trim(),
        m365_client_id: cfg.client_id.trim(),
        m365_journal_mailbox: cfg.journal_mailbox.trim(),
        updated_at: new Date().toISOString(),
      };
      if (secretChanged && cfg.client_secret) update.m365_client_secret = cfg.client_secret;

      if (cfg.id) {
        const { error } = await supabase.from("email_classifier_settings").update(update).eq("id", cfg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("email_classifier_settings").insert(update);
        if (error) throw error;
      }
      toast({ title: "Configuración guardada" });
      setSecretChanged(false);
      loadCfg();
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e?.message || String(e), variant: "destructive" });
    } finally { setM365Saving(false); }
  };

  const testConnection = async () => {
    setM365Testing(true);
    try {
      const body: any = { test: true, tenant_id: cfg.tenant_id.trim(), client_id: cfg.client_id.trim(), journal_mailbox: cfg.journal_mailbox.trim() };
      if (secretChanged && cfg.client_secret) body.client_secret = cfg.client_secret;
      const { data, error } = await supabase.functions.invoke("m365-journal-sync", { body });
      if (error) throw error;
      const d = data as any;
      if (d?.ok) toast({ title: "Conexión OK", description: d.message });
      else toast({ title: "Fallo de conexión", description: d?.error || "sin detalle", variant: "destructive" });
      loadCfg();
    } catch (e: any) {
      toast({ title: "Error probando conexión", description: e?.message || String(e), variant: "destructive" });
    } finally { setM365Testing(false); }
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
    } finally { setM365Syncing(false); }
  };

  const updateUmbral = async (field: "umbral_auto" | "umbral_revision", v: number) => {
    if (isNaN(v) || v < 0 || v > 1) return;
    if (!cfg.id) return;
    const upd: any = { updated_at: new Date().toISOString() };
    upd[field] = v;
    await supabase.from("email_classifier_settings").update(upd).eq("id", cfg.id);
    setM365Stats((s) => ({ ...s, [field === "umbral_auto" ? "umbralAuto" : "umbralRev"]: v } as any));
    toast({ title: "Umbral actualizado", description: `${Math.round(v * 100)}%` });
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

          {/* Correo M365 — Configuración */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Correo M365 · Vinculación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Tenant ID</Label>
                  <Input value={cfg.tenant_id} onChange={(e) => setCfg({ ...cfg, tenant_id: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client ID</Label>
                  <Input value={cfg.client_id} onChange={(e) => setCfg({ ...cfg, client_id: e.target.value })} placeholder="app registration" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client Secret</Label>
                  <Input
                    type="password"
                    value={secretChanged ? cfg.client_secret : ""}
                    onChange={(e) => { setCfg({ ...cfg, client_secret: e.target.value }); setSecretChanged(true); }}
                    placeholder={cfg.client_secret_masked || "Introduce el client secret"}
                  />
                  {cfg.client_secret_masked && !secretChanged && (
                    <p className="text-[10px] text-muted-foreground">Actualmente: {cfg.client_secret_masked}. Escribe para reemplazar.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Buzón de captura (journal_mailbox)</Label>
                  <Input value={cfg.journal_mailbox} onChange={(e) => setCfg({ ...cfg, journal_mailbox: e.target.value })} placeholder="journal@empresa.com" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant={cfg.connected ? "default" : "secondary"} className={cfg.connected ? "bg-chart-2/20 text-chart-2" : ""}>
                  {cfg.connected ? "Conectado" : "No probado"}
                </Badge>
                {cfg.last_test_at && (
                  <span className="text-xs text-muted-foreground">Último test: {new Date(cfg.last_test_at).toLocaleString("es-ES")}</span>
                )}
              </div>
              {cfg.last_test_result && (
                <p className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">{cfg.last_test_result}</p>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-1 border-t">
                <Button variant="outline" size="sm" onClick={testConnection} disabled={m365Testing || !cfg.tenant_id || !cfg.client_id || !cfg.journal_mailbox}>
                  {m365Testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plug className="h-3.5 w-3.5 mr-1" />} Probar conexión
                </Button>
                <Button size="sm" onClick={saveCfg} disabled={m365Saving}>
                  {m365Saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />} Guardar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Correo M365 — Actividad */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Correo M365 · Actividad</CardTitle>
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
                      <Label className="text-xs">Umbral automático (0–1)</Label>
                      <Input type="number" min={0} max={1} step={0.05} defaultValue={m365Stats.umbralAuto} onBlur={(e) => updateUmbral("umbral_auto", Number(e.target.value))} className="w-32" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Umbral revisión (0–1)</Label>
                      <Input type="number" min={0} max={1} step={0.05} defaultValue={m365Stats.umbralRev} onBlur={(e) => updateUmbral("umbral_revision", Number(e.target.value))} className="w-32" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ≥ automático → clasificado sin intervención · entre revisión y automático → bandeja con propuesta · &lt; revisión → bandeja sin propuesta (clasificas desde cero).
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Reclasificación del archivo */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Reclasificación del archivo histórico</CardTitle>
                <Button size="sm" variant="outline" onClick={fetchBfStatus} disabled={bfLoading}>
                  {bfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />} Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Vincula el archivo importado (documentos y adjuntos) a contactos, hilos y proyectos. No borra nada;
                solo rellena vínculos vacíos y es reversible por fase (queda registrado en <code>metadata_extraida.linked_by</code>).
              </p>

              {bfStatus && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Docs totales</p><p className="text-xl font-bold">{bfStatus.documentos?.total?.toLocaleString("es-ES")}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Con contacto</p><p className="text-xl font-bold text-chart-2">{bfStatus.documentos?.con_contacto?.toLocaleString("es-ES")}</p><p className="text-[10px] text-muted-foreground">Pendientes: {bfStatus.documentos?.pendientes_contacto?.toLocaleString("es-ES")}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Con proyecto</p><p className="text-xl font-bold text-chart-2">{bfStatus.documentos?.con_proyecto?.toLocaleString("es-ES")}</p><p className="text-[10px] text-muted-foreground">Pendientes: {bfStatus.documentos?.pendientes_proyecto?.toLocaleString("es-ES")}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Con operador</p><p className="text-xl font-bold">{bfStatus.documentos?.con_operador?.toLocaleString("es-ES")}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Chunks con proyecto</p><p className="text-xl font-bold">{bfStatus.chunks?.con_proyecto?.toLocaleString("es-ES")}</p><p className="text-[10px] text-muted-foreground">de {bfStatus.chunks?.total?.toLocaleString("es-ES")}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Proyectos duplicados</p><p className="text-xl font-bold">{bfStatus.proyectos_duplicados?.length || 0}</p><p className="text-[10px] text-muted-foreground">Se usa el más antiguo</p></div>
                </div>
              )}

              {bfProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{bfProgress.phase} · procesados {bfProgress.processed} · vinculados {bfProgress.linked}</span>
                    <span className="text-muted-foreground">restantes {bfProgress.remaining}</span>
                  </div>
                  <Progress value={bfProgress.remaining > 0 ? Math.min(95, (bfProgress.processed / (bfProgress.processed + bfProgress.remaining)) * 100) : 100} />
                </div>
              )}

              <div className="space-y-2">
                {[
                  { key: "contactos_from", label: "1 · Contactos por remitente (from)", hint: "Match exacto de email del remitente contra contactos" },
                  { key: "contactos_to", label: "2 · Contactos por destinatario (to)", hint: "Primer email del to que coincida con un contacto" },
                  { key: "hilos", label: "3 · Herencia por hilo (thread_id)", hint: "Hereda contacto/proyecto/operador de otro doc del mismo hilo ya vinculado" },
                  { key: "proyectos_tokens", label: "4 · Proyectos por tokens únicos del nombre", hint: "Tokens ≥5 chars exclusivos de un proyecto activo en nombre o asunto" },
                  { key: "chunks", label: "5 · Propagar proyecto a document_chunks", hint: "Copia proyecto_id del documento a sus chunks" },
                ].map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{f.label}</p>
                      <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => runBackfill(f.key, true)} disabled={!!bfRunning}>
                        {bfRunning === f.key + ":dry" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FlaskConical className="h-3.5 w-3.5 mr-1" />} Simulacro
                      </Button>
                      <Button size="sm" onClick={() => runBackfill(f.key, false)} disabled={!!bfRunning}>
                        {bfRunning === f.key ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />} Ejecutar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}
