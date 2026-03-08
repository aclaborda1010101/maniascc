import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  proyectoId: string;
  activos: any[];
  onRefresh: () => void;
}

export function ProyectoActivos({ proyectoId, activos, onRefresh }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("activos").insert({
      proyecto_id: proyectoId,
      nombre: fd.get("nombre") as string,
      tipo_activo: (fd.get("tipo_activo") as string) || null,
      direccion: (fd.get("direccion") as string) || null,
      codigo_postal: (fd.get("codigo_postal") as string) || null,
      metros_cuadrados: fd.get("metros_cuadrados") ? Number(fd.get("metros_cuadrados")) : null,
      renta_esperada: fd.get("renta_esperada") ? Number(fd.get("renta_esperada")) : null,
      creado_por: user?.id,
    });
    setSubmitting(false);
    if (!error) { setDialogOpen(false); onRefresh(); toast({ title: "Activo añadido" }); }
    else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{activos.length} activo{activos.length !== 1 ? "s" : ""}</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-1 h-3.5 w-3.5" /> Añadir Activo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Añadir Activo al Proyecto</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><Label>Nombre *</Label><Input name="nombre" placeholder="Local 12-A Planta Baja" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select name="tipo_activo" defaultValue="local_comercial">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local_comercial">Local Comercial</SelectItem>
                      <SelectItem value="centro_comercial">Centro Comercial</SelectItem>
                      <SelectItem value="parque_medianas">Parque Medianas</SelectItem>
                      <SelectItem value="high_street">High Street</SelectItem>
                      <SelectItem value="nave">Nave</SelectItem>
                      <SelectItem value="suelo">Suelo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>m²</Label><Input name="metros_cuadrados" type="number" placeholder="150" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Dirección</Label><Input name="direccion" placeholder="Av. Principal 12" /></div>
                <div className="space-y-2"><Label>Renta esperada (€/mes)</Label><Input name="renta_esperada" type="number" placeholder="3000" /></div>
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                {submitting ? "Añadiendo..." : "Añadir Activo"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {activos.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">No hay activos en este proyecto.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activos.map((a) => (
            <Card key={a.id}>
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold">{a.nombre}</h4>
                  <Badge variant="outline" className="text-xs">{a.estado}</Badge>
                </div>
                {a.tipo_activo && <Badge variant="secondary" className="text-xs">{a.tipo_activo.replace(/_/g, " ")}</Badge>}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {a.metros_cuadrados && <span>{Number(a.metros_cuadrados).toLocaleString("es-ES")} m²</span>}
                  {a.renta_esperada && <span>{Number(a.renta_esperada).toLocaleString("es-ES")} €/mes</span>}
                </div>
                {a.direccion && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{a.direccion}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
