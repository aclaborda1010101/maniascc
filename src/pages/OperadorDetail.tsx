import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Trash2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export default function OperadorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [op, setOp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("operadores").select("*").eq("id", id).single().then(({ data }) => {
      setOp(data);
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    if (!op) return;
    setSaving(true);
    const { error } = await supabase.from("operadores").update({
      nombre: op.nombre,
      sector: op.sector,
      presupuesto_min: op.presupuesto_min,
      presupuesto_max: op.presupuesto_max,
      superficie_min: op.superficie_min,
      superficie_max: op.superficie_max,
      contacto_nombre: op.contacto_nombre,
      contacto_email: op.contacto_email,
      contacto_telefono: op.contacto_telefono,
      descripcion: op.descripcion,
      activo: op.activo,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/operadores")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{op.nombre}</h1>
          <p className="text-muted-foreground">{op.sector}</p>
        </div>
        <Button variant="destructive" size="icon" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Datos del Operador</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={op.nombre} onChange={(e) => setOp({ ...op, nombre: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Sector</Label>
                <Input value={op.sector} onChange={(e) => setOp({ ...op, sector: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Presupuesto Min (€)</Label>
                <Input type="number" value={op.presupuesto_min} onChange={(e) => setOp({ ...op, presupuesto_min: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Presupuesto Max (€)</Label>
                <Input type="number" value={op.presupuesto_max} onChange={(e) => setOp({ ...op, presupuesto_max: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Superficie Min (m²)</Label>
                <Input type="number" value={op.superficie_min} onChange={(e) => setOp({ ...op, superficie_min: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Superficie Max (m²)</Label>
                <Input type="number" value={op.superficie_max} onChange={(e) => setOp({ ...op, superficie_max: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Input value={op.contacto_nombre || ""} onChange={(e) => setOp({ ...op, contacto_nombre: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={op.contacto_email || ""} onChange={(e) => setOp({ ...op, contacto_email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={op.contacto_telefono || ""} onChange={(e) => setOp({ ...op, contacto_telefono: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={op.descripcion || ""} onChange={(e) => setOp({ ...op, descripcion: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={op.activo} onCheckedChange={(v) => setOp({ ...op, activo: v })} />
              <Label>Operador activo</Label>
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" /> Perfil IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {op.perfil_ia ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{op.perfil_ia}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                El perfil IA se generará automáticamente cuando se ejecute un matching con este operador.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
