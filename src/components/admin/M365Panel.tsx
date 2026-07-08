import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Loader2, Plug, Save, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function M365Panel() {
  const [m365Stats, setM365Stats] = useState<{ pending: number; needs_review: number; applied: number; discarded: number; error: number; last_synced: string | null; umbralAuto: number; umbralRev: number }>({ pending: 0, needs_review: 0, applied: 0, discarded: 0, error: 0, last_synced: null, umbralAuto: 0.85, umbralRev: 0.60 });
  const [m365Loading, setM365Loading] = useState(false);
  const [m365Syncing, setM365Syncing] = useState(false);
  const [m365Testing, setM365Testing] = useState(false);
  const [m365Saving, setM365Saving] = useState(false);

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

  useEffect(() => { fetchM365(); loadCfg(); }, []);

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

  return (
    <div className="space-y-4">
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
    </div>
  );
}
