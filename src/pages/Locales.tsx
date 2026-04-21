import { useEffect, useState, useRef } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";

const estadoTone: Record<string, string> = {
  disponible: "acc-4",
  en_negociacion: "acc-5",
  ocupado: "acc-3",
  reforma: "acc-2",
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
  const isMobile = useIsMobile();

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchLocales = async () => {
    setLoading(true);
    let query = supabase.from("locales").select("id, nombre, direccion, ciudad, codigo_postal, superficie_m2, precio_renta, estado, created_at").order("created_at", { ascending: false }).limit(60);
    if (filtroEstado !== "todos") query = query.eq("estado", filtroEstado as any);
    if (debouncedSearch) query = query.or(`nombre.ilike.%${debouncedSearch}%,direccion.ilike.%${debouncedSearch}%,codigo_postal.ilike.%${debouncedSearch}%,ciudad.ilike.%${debouncedSearch}%`);
    const { data } = await query;
    setLocales(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLocales(); }, [filtroEstado, debouncedSearch]);

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
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-medium">Cartera · {locales.length}</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            <span className="text-iridescent">Activos</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">Gestiona los activos comerciales de tus centros.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl gradient-iridescent text-white border-0 hover:opacity-95 w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Activo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Crear Nuevo Activo</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-nombre">Nombre *</Label>
                  <Input id="c-nombre" name="nombre" placeholder="Local 12-A" required />
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <Textarea id="c-desc" name="descripcion" placeholder="Detalles adicionales..." rows={3} />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                {submitting ? "Creando..." : "Crear Activo"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass p-4 md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center pb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, dirección..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-2xl bg-white/[0.04] border-border/40" />
          </div>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-2xl bg-white/[0.04] border-border/40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="disponible">Disponible</SelectItem>
              <SelectItem value="en_negociacion">En negociación</SelectItem>
              <SelectItem value="ocupado">Ocupado</SelectItem>
              <SelectItem value="reforma">En reforma</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : locales.length === 0 ? (
            <div className="py-12 text-center">
              <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">{search || filtroEstado !== "todos" ? "No se encontraron activos." : "No hay activos. Crea el primero."}</p>
            </div>
          ) : isMobile ? (
            /* Mobile: card layout */
            <div className="space-y-2">
              {locales.map((l) => (
                <Link key={l.id} to={`/activos/${l.id}`}>
                  <Card className="hover:border-accent/40 transition-colors shadow-sm">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-accent truncate">{l.nombre}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{l.direccion}</p>
                        </div>
                        <Badge variant="secondary" className={`shrink-0 text-[10px] ${estadoColors[l.estado] || ""}`}>
                          {estadoLabels[l.estado] || l.estado}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{l.ciudad}</span>
                        <span>{Number(l.superficie_m2).toLocaleString("es-ES")} m²</span>
                        <span className="ml-auto font-medium text-foreground">{Number(l.precio_renta).toLocaleString("es-ES")} €/mes</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            /* Desktop: table */
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
                      <Link to={`/activos/${l.id}`} className="font-medium text-accent hover:underline">{l.nombre}</Link>
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
            <p className="mt-3 text-xs text-muted-foreground">{locales.length} activo{locales.length !== 1 ? "s" : ""}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
