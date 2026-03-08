import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Operadores() {
  const [operadores, setOperadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchOperadores = async () => {
    setLoading(true);
    let query = supabase.from("operadores").select("*").order("created_at", { ascending: false });
    if (search) query = query.or(`nombre.ilike.%${search}%,sector.ilike.%${search}%`);
    const { data } = await query;
    setOperadores(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchOperadores(); }, [search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("operadores").insert({
      nombre: fd.get("nombre") as string,
      sector: fd.get("sector") as string,
      presupuesto_min: Number(fd.get("presupuesto_min")),
      presupuesto_max: Number(fd.get("presupuesto_max")),
      superficie_min: Number(fd.get("superficie_min")),
      superficie_max: Number(fd.get("superficie_max")),
      contacto_nombre: fd.get("contacto_nombre") as string,
      contacto_email: fd.get("contacto_email") as string,
      contacto_telefono: fd.get("contacto_telefono") as string,
      descripcion: fd.get("descripcion") as string,
      created_by: user?.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Operador creado" });
      setDialogOpen(false);
      fetchOperadores();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operadores</h1>
          <p className="text-muted-foreground">Directorio de operadores comerciales</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Operador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Operador</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input name="nombre" required />
                </div>
                <div className="space-y-2">
                  <Label>Sector</Label>
                  <Input name="sector" placeholder="Hostelería, Retail..." required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Presupuesto Min (€)</Label>
                  <Input name="presupuesto_min" type="number" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Presupuesto Max (€)</Label>
                  <Input name="presupuesto_max" type="number" min="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Superficie Min (m²)</Label>
                  <Input name="superficie_min" type="number" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Superficie Max (m²)</Label>
                  <Input name="superficie_max" type="number" min="0" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Contacto</Label>
                  <Input name="contacto_nombre" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input name="contacto_email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input name="contacto_telefono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input name="descripcion" />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                Crear Operador
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o sector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : operadores.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">No hay operadores. Crea el primero.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Presupuesto</TableHead>
                  <TableHead>Superficie</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operadores.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link to={`/operadores/${o.id}`} className="font-medium text-accent hover:underline">
                        {o.nombre}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{o.sector}</Badge></TableCell>
                    <TableCell>{Number(o.presupuesto_min).toLocaleString("es-ES")} – {Number(o.presupuesto_max).toLocaleString("es-ES")} €</TableCell>
                    <TableCell>{o.superficie_min} – {o.superficie_max} m²</TableCell>
                    <TableCell>
                      <Badge variant={o.activo ? "default" : "secondary"} className={o.activo ? "bg-chart-2/10 text-chart-2" : ""}>
                        {o.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
