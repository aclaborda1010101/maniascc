import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const estadoColors: Record<string, string> = {
  disponible: "bg-chart-2/10 text-chart-2",
  en_negociacion: "bg-chart-3/10 text-chart-3",
  ocupado: "bg-chart-4/10 text-chart-4",
  reforma: "bg-chart-5/10 text-chart-5",
};

export default function Locales() {
  const [locales, setLocales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchLocales = async () => {
    setLoading(true);
    let query = supabase.from("locales").select("*").order("created_at", { ascending: false });
    if (filtroEstado !== "todos") query = query.eq("estado", filtroEstado as any);
    if (search) query = query.or(`nombre.ilike.%${search}%,direccion.ilike.%${search}%,codigo_postal.ilike.%${search}%`);
    const { data } = await query;
    setLocales(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLocales(); }, [filtroEstado, search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("locales").insert({
      nombre: fd.get("nombre") as string,
      direccion: fd.get("direccion") as string,
      codigo_postal: fd.get("codigo_postal") as string,
      ciudad: fd.get("ciudad") as string,
      superficie_m2: Number(fd.get("superficie_m2")),
      precio_renta: Number(fd.get("precio_renta")),
      descripcion: fd.get("descripcion") as string,
      created_by: user?.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Local creado" });
      setDialogOpen(false);
      fetchLocales();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locales</h1>
          <p className="text-muted-foreground">Directorio de locales comerciales</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Local
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Local</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input name="nombre" required />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input name="ciudad" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input name="direccion" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Código Postal</Label>
                  <Input name="codigo_postal" />
                </div>
                <div className="space-y-2">
                  <Label>Superficie (m²)</Label>
                  <Input name="superficie_m2" type="number" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Renta (€/mes)</Label>
                  <Input name="precio_renta" type="number" min="0" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input name="descripcion" />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                Crear Local
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, dirección o CP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="disponible">Disponible</SelectItem>
                <SelectItem value="en_negociacion">En negociación</SelectItem>
                <SelectItem value="ocupado">Ocupado</SelectItem>
                <SelectItem value="reforma">En reforma</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : locales.length === 0 ? (
            <div className="py-12 text-center">
              <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">No hay locales. Crea el primero.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>m²</TableHead>
                  <TableHead>Renta</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locales.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link to={`/locales/${l.id}`} className="font-medium text-accent hover:underline">
                        {l.nombre}
                      </Link>
                    </TableCell>
                    <TableCell>{l.ciudad}</TableCell>
                    <TableCell>{l.superficie_m2}</TableCell>
                    <TableCell>{Number(l.precio_renta).toLocaleString("es-ES")} €</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={estadoColors[l.estado] || ""}>
                        {l.estado?.replace("_", " ")}
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
