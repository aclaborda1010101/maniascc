import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, Mail, CheckCircle2, Loader2, QrCode, Settings,
  Shield, Sparkles, CheckCircle, Link2, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════
   TAB: Conexiones (WhatsApp + Email)
   ═══════════════════════════════════════════════════ */
function TabConexiones() {
  const { user } = useAuth();

  const [evoUrl, setEvoUrl] = useState("");
  const [evoKey, setEvoKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [waConnected, setWaConnected] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUser, setImapUser] = useState("");
  const [imapPass, setImapPass] = useState("");
  const [imapConnected, setImapConnected] = useState(false);
  const [imapLoading, setImapLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("perfiles").select("*").eq("user_id", user.id).single();
      if (data) {
        setEvoUrl((data as any).evolution_instance_url || "");
        setEvoKey((data as any).evolution_api_key || "");
        setInstanceName((data as any).evolution_instance_name || "");
        setWaConnected((data as any).evolution_connected || false);
        setImapHost((data as any).imap_host || "");
        setImapPort(String((data as any).imap_port || 993));
        setImapUser((data as any).imap_user || "");
        setImapConnected((data as any).imap_connected || false);
      }
    })();
  }, [user]);

  useEffect(() => { return () => { if (pollingRef.current) clearInterval(pollingRef.current); }; }, []);

  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("evolution-manage", {
        body: { action: "check_status", instance_name: instanceName },
      });
      if (error) return;
      const state = data?.instance?.state || data?.state;
      if (state === "open") {
        setWaConnected(true);
        setQrCode(null);
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        await supabase.from("perfiles").update({ evolution_connected: true } as any).eq("user_id", user!.id);
        toast.success("WhatsApp conectado correctamente");
      }
    } catch {}
  }, [instanceName, user]);

  const handleConnectWhatsApp = async () => {
    if (!evoUrl || !evoKey || !instanceName) { toast.error("Completa todos los campos de WhatsApp"); return; }
    setWaLoading(true);
    try {
      await supabase.from("perfiles").update({
        evolution_instance_url: evoUrl, evolution_api_key: evoKey, evolution_instance_name: instanceName,
      } as any).eq("user_id", user!.id);

      const { data, error } = await supabase.functions.invoke("evolution-manage", {
        body: { action: "create_instance", instance_name: instanceName, evolution_url: evoUrl, evolution_api_key: evoKey },
      });
      if (error) throw error;

      const qr = data?.qrcode?.base64 || data?.base64 || data?.qr;
      if (qr) {
        setQrCode(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`);
      } else {
        const { data: qrData } = await supabase.functions.invoke("evolution-manage", {
          body: { action: "get_qr", instance_name: instanceName },
        });
        const qr2 = qrData?.base64 || qrData?.qrcode?.base64;
        if (qr2) setQrCode(qr2.startsWith("data:") ? qr2 : `data:image/png;base64,${qr2}`);
      }

      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(checkStatus, 3000);
      toast.info("Escanea el código QR con WhatsApp");
    } catch (err: any) {
      toast.error(err.message || "Error al conectar WhatsApp");
    } finally { setWaLoading(false); }
  };

  const handleConnectEmail = async () => {
    if (!imapHost || !imapUser || !imapPass) { toast.error("Completa todos los campos de email"); return; }
    setImapLoading(true);
    try {
      await supabase.from("perfiles").update({
        imap_host: imapHost, imap_port: parseInt(imapPort) || 993,
        imap_user: imapUser, imap_password_encrypted: imapPass, imap_connected: true,
      } as any).eq("user_id", user!.id);
      setImapConnected(true);
      toast.success("Configuración de email guardada");
    } catch (err: any) { toast.error(err.message || "Error al guardar email"); }
    finally { setImapLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-chart-2" />
              <CardTitle>WhatsApp (Evolution API)</CardTitle>
            </div>
            {waConnected && <Badge variant="secondary" className="bg-chart-2/10 text-chart-2"><CheckCircle2 className="mr-1 h-3 w-3" /> Conectado</Badge>}
          </div>
          <CardDescription>Conecta tu número de WhatsApp vía Evolution API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Evolution API URL</Label><Input placeholder="https://evolution.ejemplo.com" value={evoUrl} onChange={(e) => setEvoUrl(e.target.value)} /></div>
            <div className="space-y-2"><Label>API Key</Label><Input type="password" placeholder="Tu API key" value={evoKey} onChange={(e) => setEvoKey(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Nombre de instancia</Label><Input placeholder="mi-instancia-whatsapp" value={instanceName} onChange={(e) => setInstanceName(e.target.value)} /></div>
          {qrCode && !waConnected && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6">
              <QrCode className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Escanea con WhatsApp</p>
              <img src={qrCode} alt="QR WhatsApp" className="h-64 w-64 rounded-md" />
              <p className="text-xs text-muted-foreground animate-pulse">Esperando conexión...</p>
            </div>
          )}
          <Button onClick={handleConnectWhatsApp} disabled={waLoading || waConnected}>
            {waLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Conectando...</> : waConnected ? <><CheckCircle2 className="mr-2 h-4 w-4" />Conectado</> : "Conectar WhatsApp"}
          </Button>
        </CardContent>
      </Card>

      {/* Email IMAP */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Email (IMAP)</CardTitle>
            </div>
            {imapConnected && <Badge variant="secondary" className="bg-primary/10 text-primary"><CheckCircle2 className="mr-1 h-3 w-3" /> Conectado</Badge>}
          </div>
          <CardDescription>Conecta tu cuenta de email para sincronizar conversaciones.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Servidor IMAP</Label><Input placeholder="imap.gmail.com" value={imapHost} onChange={(e) => setImapHost(e.target.value)} /></div>
            <div className="space-y-2"><Label>Puerto</Label><Input type="number" placeholder="993" value={imapPort} onChange={(e) => setImapPort(e.target.value)} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Usuario / Email</Label><Input placeholder="usuario@ejemplo.com" value={imapUser} onChange={(e) => setImapUser(e.target.value)} /></div>
            <div className="space-y-2"><Label>Contraseña</Label><Input type="password" placeholder="••••••••" value={imapPass} onChange={(e) => setImapPass(e.target.value)} /></div>
          </div>
          <Button onClick={handleConnectEmail} disabled={imapLoading || imapConnected}>
            {imapLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : imapConnected ? <><CheckCircle2 className="mr-2 h-4 w-4" />Conectado</> : "Conectar email"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TAB: Conexión IA — RETIRADO (Expert Forge MoE externo desactivado)
   El sistema usa exclusivamente RAG interno (rag-proxy + document_chunks)
   y Lovable AI Gateway. Ver pestaña "Configuración" para arquitectura.
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   TAB: Auditoría
   ═══════════════════════════════════════════════════ */
function TabAuditoria() {
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [filterFuncion, setFilterFuncion] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  useEffect(() => {
    supabase.from("auditoria_ia").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => { setLogs(data || []); setLogsLoading(false); });
  }, []);

  const filteredLogs = logs.filter(l => {
    if (filterFuncion !== "all" && l.funcion_ia !== filterFuncion) return false;
    if (filterDateFrom && new Date(l.created_at) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(l.created_at) > new Date(filterDateTo + "T23:59:59")) return false;
    return true;
  });

  const avgLatency = filteredLogs.length > 0 ? Math.round(filteredLogs.reduce((sum, l) => sum + (Number(l.latencia_ms) || 0), 0) / filteredLogs.length) : 0;
  const funciones = [...new Set(logs.map(l => l.funcion_ia).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Operaciones</p><p className="text-2xl font-bold">{filteredLogs.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Tasa de éxito</p><p className="text-2xl font-bold">{filteredLogs.length > 0 ? Math.round((filteredLogs.filter(l => l.exito).length / filteredLogs.length) * 100) : 0}%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Latencia media</p><p className="text-2xl font-bold">{avgLatency}ms</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1"><Label className="text-xs">Función</Label><Select value={filterFuncion} onValueChange={setFilterFuncion}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{funciones.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-40" /></div>
        <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-40" /></div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Operaciones</CardTitle></CardHeader>
        <CardContent>
          {logsLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> :
           filteredLogs.length === 0 ? <div className="py-12 text-center"><Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="text-muted-foreground">No hay operaciones registradas.</p></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Función</TableHead><TableHead>Modelo</TableHead><TableHead>Latencia</TableHead><TableHead>Tokens</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredLogs.map(l => (
                  <TableRow key={l.id}><TableCell className="font-medium">{l.funcion_ia || "—"}</TableCell><TableCell className="text-xs">{l.modelo}</TableCell><TableCell>{l.latencia_ms ? `${l.latencia_ms}ms` : "—"}</TableCell><TableCell className="text-xs">{l.tokens_entrada || 0} → {l.tokens_salida || 0}</TableCell><TableCell><Badge variant="secondary" className={l.exito ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}>{l.exito ? "OK" : "Error"}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("es-ES")}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TAB: Configuración
   ═══════════════════════════════════════════════════ */
function TabConfiguracion() {
  return (
    <div className="space-y-4">
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
            ].map(f => (
              <div key={f.fn} className="rounded-lg border p-3 flex items-center justify-between">
                <div><p className="text-sm font-medium">{f.name}</p><p className="text-xs text-muted-foreground font-mono">{f.fn}</p></div>
                <CheckCircle className="h-4 w-4 text-chart-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   TAB: Perfil (nombre, email, contraseña)
   ═══════════════════════════════════════════════════ */
function TabPerfil() {
  const { user } = useAuth();
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");
    (async () => {
      const { data } = await supabase.from("perfiles").select("nombre, apellidos, telefono").eq("user_id", user.id).single();
      if (data) {
        setNombre(data.nombre || "");
        setApellidos(data.apellidos || "");
        setTelefono(data.telefono || "");
      }
    })();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("perfiles").update({
        nombre,
        apellidos,
        telefono,
      }).eq("user_id", user.id);
      if (error) throw error;

      // Update email if changed
      if (email !== user.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email });
        if (emailErr) throw emailErr;
        toast.success("Se ha enviado un email de confirmación a la nueva dirección");
      } else {
        toast.success("Perfil actualizado correctamente");
      }
    } catch (e: any) {
      toast.error(e.message || "Error al guardar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setChangingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message || "Error al cambiar contraseña");
    } finally {
      setChangingPwd(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos personales</CardTitle>
          <CardDescription>Actualiza tu nombre, email y teléfono</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" />
            </div>
            <div className="space-y-2">
              <Label>Apellidos</Label>
              <Input value={apellidos} onChange={e => setApellidos(e.target.value)} placeholder="Apellidos" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com" />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+34 600 000 000" />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Guardar cambios
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cambiar contraseña</CardTitle>
          <CardDescription>Introduce tu nueva contraseña</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar contraseña</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPwd} variant="outline" className="w-full">
            {changingPwd ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Cambiar contraseña
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Ajustes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" /> Ajustes
        </h1>
        <p className="text-sm text-muted-foreground">Perfil, conexiones, auditoría y configuración del sistema</p>
      </div>

      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil" className="gap-1"><User className="h-3 w-3" /> Perfil</TabsTrigger>
          <TabsTrigger value="conexiones" className="gap-1"><Link2 className="h-3 w-3" /> Conexiones</TabsTrigger>
          <TabsTrigger value="conexion-ia" className="gap-1"><Sparkles className="h-3 w-3" /> Conexión IA</TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1"><Shield className="h-3 w-3" /> Auditoría</TabsTrigger>
          <TabsTrigger value="config" className="gap-1"><Settings className="h-3 w-3" /> Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil"><TabPerfil /></TabsContent>
        <TabsContent value="conexiones"><TabConexiones /></TabsContent>
        <TabsContent value="conexion-ia"><TabConexionIA /></TabsContent>
        <TabsContent value="auditoria"><TabAuditoria /></TabsContent>
        <TabsContent value="config"><TabConfiguracion /></TabsContent>
      </Tabs>
    </div>
  );
}
