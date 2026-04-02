import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Mail, CheckCircle2, Loader2, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Ajustes() {
  const { user } = useAuth();

  // WhatsApp state
  const [evoUrl, setEvoUrl] = useState("");
  const [evoKey, setEvoKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [waConnected, setWaConnected] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // IMAP state
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUser, setImapUser] = useState("");
  const [imapPass, setImapPass] = useState("");
  const [imapConnected, setImapConnected] = useState(false);
  const [imapLoading, setImapLoading] = useState(false);

  // Load profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("perfiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
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

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

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
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        await supabase
          .from("perfiles")
          .update({ evolution_connected: true } as any)
          .eq("user_id", user!.id);
        toast.success("WhatsApp conectado correctamente");
      }
    } catch {}
  }, [instanceName, user]);

  const handleConnectWhatsApp = async () => {
    if (!evoUrl || !evoKey || !instanceName) {
      toast.error("Completa todos los campos de WhatsApp");
      return;
    }
    setWaLoading(true);
    try {
      // Save credentials
      await supabase
        .from("perfiles")
        .update({
          evolution_instance_url: evoUrl,
          evolution_api_key: evoKey,
          evolution_instance_name: instanceName,
        } as any)
        .eq("user_id", user!.id);

      // Create instance
      const { data, error } = await supabase.functions.invoke("evolution-manage", {
        body: {
          action: "create_instance",
          instance_name: instanceName,
          evolution_url: evoUrl,
          evolution_api_key: evoKey,
        },
      });

      if (error) throw error;

      const qr = data?.qrcode?.base64 || data?.base64 || data?.qr;
      if (qr) {
        const src = qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
        setQrCode(src);
      } else {
        // Try get_qr
        const { data: qrData } = await supabase.functions.invoke("evolution-manage", {
          body: { action: "get_qr", instance_name: instanceName },
        });
        const qr2 = qrData?.base64 || qrData?.qrcode?.base64;
        if (qr2) {
          const src = qr2.startsWith("data:") ? qr2 : `data:image/png;base64,${qr2}`;
          setQrCode(src);
        }
      }

      // Start polling
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(checkStatus, 3000);
      toast.info("Escanea el código QR con WhatsApp");
    } catch (err: any) {
      toast.error(err.message || "Error al conectar WhatsApp");
    } finally {
      setWaLoading(false);
    }
  };

  const handleConnectEmail = async () => {
    if (!imapHost || !imapUser || !imapPass) {
      toast.error("Completa todos los campos de email");
      return;
    }
    setImapLoading(true);
    try {
      await supabase
        .from("perfiles")
        .update({
          imap_host: imapHost,
          imap_port: parseInt(imapPort) || 993,
          imap_user: imapUser,
          imap_password_encrypted: imapPass,
          imap_connected: true,
        } as any)
        .eq("user_id", user!.id);
      setImapConnected(true);
      toast.success("Configuración de email guardada");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar email");
    } finally {
      setImapLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground">Configura tus conexiones externas</p>
      </div>

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              <CardTitle>WhatsApp (Evolution API)</CardTitle>
            </div>
            {waConnected && (
              <Badge className="bg-green-600 text-white">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado
              </Badge>
            )}
          </div>
          <CardDescription>
            Conecta tu número de WhatsApp vía Evolution API para gestionar conversaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Evolution API URL</Label>
              <Input
                placeholder="https://evolution.ejemplo.com"
                value={evoUrl}
                onChange={(e) => setEvoUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="Tu API key"
                value={evoKey}
                onChange={(e) => setEvoKey(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nombre de instancia</Label>
            <Input
              placeholder="mi-instancia-whatsapp"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
            />
          </div>

          {qrCode && !waConnected && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6">
              <QrCode className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Escanea con WhatsApp</p>
              <img src={qrCode} alt="QR WhatsApp" className="h-64 w-64 rounded-md" />
              <p className="text-xs text-muted-foreground animate-pulse">
                Esperando conexión...
              </p>
            </div>
          )}

          <Button onClick={handleConnectWhatsApp} disabled={waLoading || waConnected}>
            {waLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando...</>
            ) : waConnected ? (
              <><CheckCircle2 className="mr-2 h-4 w-4" /> Conectado</>
            ) : (
              "Conectar WhatsApp"
            )}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Email IMAP */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <CardTitle>Email (IMAP)</CardTitle>
            </div>
            {imapConnected && (
              <Badge className="bg-blue-600 text-white">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado
              </Badge>
            )}
          </div>
          <CardDescription>
            Conecta tu cuenta de email para sincronizar conversaciones con contactos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Servidor IMAP</Label>
              <Input
                placeholder="imap.gmail.com"
                value={imapHost}
                onChange={(e) => setImapHost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Puerto</Label>
              <Input
                type="number"
                placeholder="993"
                value={imapPort}
                onChange={(e) => setImapPort(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Usuario / Email</Label>
              <Input
                placeholder="usuario@ejemplo.com"
                value={imapUser}
                onChange={(e) => setImapUser(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={imapPass}
                onChange={(e) => setImapPass(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleConnectEmail} disabled={imapLoading || imapConnected}>
            {imapLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
            ) : imapConnected ? (
              <><CheckCircle2 className="mr-2 h-4 w-4" /> Conectado</>
            ) : (
              "Conectar email"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
