import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Trash2, Sparkles, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { UploadZone } from "@/components/UploadZone";

export default function OperadorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [op, setOp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [docFiles, setDocFiles] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("operadores").select("*").eq("id", id).single().then(({ data }) => {
      setOp(data);
      setLoading(false);
    });
    fetchDocs();
  }, [id]);

  const fetchDocs = async () => {
    const { data } = await supabase.storage.from("documentos_contratos").list(`operadores/${id}`, { limit: 100 });
    setDocFiles((data || []).filter(f => f.name !== ".emptyFolderPlaceholder"));
  };

  const handleSave = async () => {
    if (!op) return;
    setSaving(true);
    const { error } = await supabase.from("operadores").update({
      nombre: op.nombre, sector: op.sector,
      presupuesto_min: op.presupuesto_min, presupuesto_max: op.presupuesto_max,
      superficie_min: op.superficie_min, superficie_max: op.superficie_max,
      contacto_nombre: op.contacto_nombre, contacto_email: op.contacto_email,
      contacto_telefono: op.contacto_telefono, descripcion: op.descripcion, activo: op.activo,
    }).eq("id", id);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Operador actualizado" });
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este operador?")) return;
    await supabase.from("operadores").delete().eq("id", id);
    navigate("/operadores");
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!op) return <p className="text-muted-foreground">Operador no encontrado.</p>;

  const perfilIA = op.perfil_ia ? (typeof op.perfil_ia === "string" ? op.perfil_ia : JSON.stringify(op.perfil_ia, null, 2)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/operadores")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{op.nombre}</h1>
          <p className="text-muted-foreground">{op.sector}</p>
        </div>
        <Badge variant={op.perfil_ia ? "default" : "secondary"}>{op.perfil_ia ? "Perfil IA Completo" : "Perfil IA Pendiente"}</Badge>
        <Button variant="destructive" size="icon" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información General</TabsTrigger>
          <TabsTrigger value="perfil-ia">Perfil IA</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader><CardTitle>Datos del Operador</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nombre</Label><Input value={op.nombre} onChange={(e) => setOp({ ...op, nombre: e.target.value })} /></div>
                <div className="space-y-2"><Label>Sector</Label><Input value={op.sector} onChange={(e) => setOp({ ...op, sector: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Presupuesto Min (€)</Label><Input type="number" value={op.presupuesto_min} onChange={(e) => setOp({ ...op, presupuesto_min: Number(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Presupuesto Max (€)</Label><Input type="number" value={op.presupuesto_max} onChange={(e) => setOp({ ...op, presupuesto_max: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Superficie Min (m²)</Label><Input type="number" value={op.superficie_min} onChange={(e) => setOp({ ...op, superficie_min: Number(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Superficie Max (m²)</Label><Input type="number" value={op.superficie_max} onChange={(e) => setOp({ ...op, superficie_max: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Contacto</Label><Input value={op.contacto_nombre || ""} onChange={(e) => setOp({ ...op, contacto_nombre: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={op.contacto_email || ""} onChange={(e) => setOp({ ...op, contacto_email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Teléfono</Label><Input value={op.contacto_telefono || ""} onChange={(e) => setOp({ ...op, contacto_telefono: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Descripción</Label><Input value={op.descripcion || ""} onChange={(e) => setOp({ ...op, descripcion: e.target.value })} /></div>
              <div className="flex items-center gap-3">
                <Switch checked={op.activo} onCheckedChange={(v) => setOp({ ...op, activo: v })} />
                <Label>Operador activo</Label>
              </div>
              <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perfil-ia">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" /> Perfil IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {perfilIA ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <pre className="whitespace-pre-wrap text-sm">{perfilIA}</pre>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-chart-2" />
                    Perfil generado por IA
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground">Sube un documento comercial para generar el perfil automáticamente.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <Card>
            <CardHeader><CardTitle>Documentos del Operador</CardTitle></CardHeader>
            <CardContent>
              <UploadZone
                bucket="documentos_contratos"
                folder={`operadores/${id}`}
                files={docFiles}
                onUploadComplete={fetchDocs}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
