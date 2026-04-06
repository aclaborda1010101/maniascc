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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const estadoColors: Record<string, string> = {
  disponible: "bg-chart-2/10 text-chart-2",
  en_negociacion: "bg-chart-3/10 text-chart-3",
  ocupado: "bg-chart-4/10 text-chart-4",
  reforma: "bg-chart-5/10 text-chart-5",
};

const estadoLabels: Record<string, string> = {
  disponible: "Disponible",
  en_negociacion: "En negociación",
  ocupado: "Ocupado",
  reforma: "En reforma",
};

export default function Locales() {
  const [locales, setLocales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchLocales = async () => {
    setLoading(true);
    let query = supabase.from("locales").select("*").order("created_at", { ascending: false });
    if (filtroEstado !== "todos") query = query.eq("estado", filtroEstado as any);
    if (search) query = query.or(`nombre.ilike.%${search}%,direccion.ilike.%${search}%,codigo_postal.ilike.%${search}%,ciudad.ilike.%${search}%`);
    const { data } = await query;
    setLocales(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLocales(); }, [filtroEstado, search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("locales").insert({
      nombre: fd.get("nombre") as string,
      direccion: fd.get("direccion") as string,
      codigo_postal: fd.get("codigo_postal") as string,
      ciudad: fd.get("ciudad") as string,
      superficie_m2: Number(fd.get("superficie_m2")),
      precio_renta: Number(fd.get("precio_renta")),
      descripcion: (fd.get("descripcion") as string) || null,
      coordenadas_lat: fd.get("coordenadas_lat") ? Number(fd.get("coordenadas_lat")) : null,
      coordenadas_lng: fd.get("coordenadas_lng") ? Number(fd.get("coordenadas_lng")) : null,
      caracteristicas: {},
      created_by: user?.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al crear activo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Activo creado correctamente" });
      setDialogOpen(false);
      fetchLocales();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locales</h1>
          <p className="text-sm text-muted-foreground">Gestiona los locales comerciales de tus centros</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Local
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Local</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-nombre">Nombre *</Label>
                  <Input id="c-nombre" name="nombre" placeholder="Local 12-A Parque Comercial" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-ciudad">Ciudad *</Label>
                  <Input id="c-ciudad" name="ciudad" placeholder="Madrid" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-dir">Dirección *</Label>
                <Input id="c-dir" name="direccion" placeholder="Av. de Europa 23" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-cp">Código Postal</Label>
                  <Input id="c-cp" name="codigo_postal" placeholder="28001" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-sup">Superficie (m²) *</Label>
                  <Input id="c-sup" name="superficie_m2" type="number" min="0" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-renta">Renta (€/mes) *</Label>
                  <Input id="c-renta" name="precio_renta" type="number" min="0" step="0.01" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-lat">Latitud</Label>
                  <Input id="c-lat" name="coordenadas_lat" type="number" step="any" placeholder="40.4168" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-lng">Longitud</Label>
                  <Input id="c-lng" name="coordenadas_lng" type="number" step="any" placeholder="-3.7038" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-desc">Descripción</Label>
                <Textarea id="c-desc" name="descripcion" placeholder="Detalles adicionales del local..." rows={3} />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                {submitting ? "Creando..." : "Crear Local"}
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
                placeholder="Buscar por nombre, dirección, ciudad o CP..."
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
              <p className="text-muted-foreground">
                {search || filtroEstado !== "todos" ? "No se encontraron locales con esos filtros." : "No hay locales. Crea el primero."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead className="text-right">m²</TableHead>
                  <TableHead className="text-right">Renta</TableHead>
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
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{l.direccion}</p>
                    </TableCell>
                    <TableCell>{l.ciudad}</TableCell>
                    <TableCell className="text-right">{Number(l.superficie_m2).toLocaleString("es-ES")}</TableCell>
                    <TableCell className="text-right">{Number(l.precio_renta).toLocaleString("es-ES")} €</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={estadoColors[l.estado] || ""}>
                        {estadoLabels[l.estado] || l.estado}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && locales.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{locales.length} local{locales.length !== 1 ? "es" : ""} encontrado{locales.length !== 1 ? "s" : ""}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
