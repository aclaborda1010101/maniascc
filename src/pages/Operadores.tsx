import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const SECTORES: { value: string; label: string }[] = [
  { value: "alimentacion", label: "Alimentación" },
  { value: "moda", label: "Moda" },
  { value: "restauracion", label: "Restauración" },
  { value: "hogar", label: "Hogar" },
  { value: "electronica", label: "Electrónica" },
  { value: "belleza", label: "Belleza" },
  { value: "deportes", label: "Deportes" },
  { value: "salud", label: "Salud" },
  { value: "servicios", label: "Servicios" },
  { value: "ocio", label: "Ocio" },
  { value: "financiero", label: "Financiero" },
  { value: "otro", label: "Otro" },
];

export default function Operadores() {
  const [operadores, setOperadores] = useState<any[]>([]);
  const [matrices, setMatrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroSector, setFiltroSector] = useState("todos");
  const [filtroActivo, setFiltroActivo] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [matrizMode, setMatrizMode] = useState<"existing" | "new">("existing");
  const [selectedMatrizId, setSelectedMatrizId] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchOperadores = async () => {
    setLoading(true);
    let query = supabase.from("operadores").select("*").order("created_at", { ascending: false });
    if (search) query = query.or(`nombre.ilike.%${search}%,sector.ilike.%${search}%,contacto_nombre.ilike.%${search}%`);
    if (filtroSector !== "todos") query = query.eq("sector", filtroSector);
    if (filtroActivo === "activo") query = query.eq("activo", true);
    if (filtroActivo === "inactivo") query = query.eq("activo", false);
    const { data } = await query;
    setOperadores(data || []);
    // Matrices = operators with no matriz_id (they ARE matrices)
    setMatrices((data || []).filter((o: any) => !o.matriz_id));
    setLoading(false);
  };

  useEffect(() => { fetchOperadores(); }, [search, filtroSector, filtroActivo]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const matrizId = matrizMode === "existing" && selectedMatrizId ? selectedMatrizId : null;
    const { error } = await supabase.from("operadores").insert({
      nombre: fd.get("nombre") as string,
      sector: fd.get("sector") as string,
      presupuesto_min: Number(fd.get("presupuesto_min")) || 0,
      presupuesto_max: Number(fd.get("presupuesto_max")) || 0,
      superficie_min: Number(fd.get("superficie_min")) || 0,
      superficie_max: Number(fd.get("superficie_max")) || 0,
      contacto_nombre: (fd.get("contacto_nombre") as string) || null,
      contacto_email: (fd.get("contacto_email") as string) || null,
      contacto_telefono: (fd.get("contacto_telefono") as string) || null,
      descripcion: (fd.get("descripcion") as string) || null,
      created_by: user?.id,
      matriz_id: matrizId,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al crear operador", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Operador creado correctamente" });
      setDialogOpen(false);
      setSelectedMatrizId("");
      setMatrizMode("existing");
      fetchOperadores();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operadores</h1>
          <p className="text-sm text-muted-foreground">Gestiona los operadores comerciales (marcas y enseñas)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Operador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Operador</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Matriz selection */}
              <div className="space-y-2">
                <Label>Matriz</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={matrizMode === "existing" ? "default" : "outline"} onClick={() => setMatrizMode("existing")}>
                    Matriz existente
                  </Button>
                  <Button type="button" size="sm" variant={matrizMode === "new" ? "default" : "outline"} onClick={() => { setMatrizMode("new"); setSelectedMatrizId(""); }}>
                    Es nueva matriz
                  </Button>
                </div>
                {matrizMode === "existing" && (
                  <Select value={selectedMatrizId} onValueChange={setSelectedMatrizId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar matriz..." /></SelectTrigger>
                    <SelectContent>
                      {matrices.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {matrizMode === "new" && (
                  <p className="text-xs text-muted-foreground">Este operador será una nueva matriz.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="o-nombre">Nombre *</Label>
                  <Input id="o-nombre" name="nombre" placeholder="Mercadona" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-sector">Sector *</Label>
                  <select
                    id="o-sector"
                    name="sector"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Seleccionar sector</option>
                    {SECTORES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="o-pmin">Presupuesto Min (€/mes)</Label>
                  <Input id="o-pmin" name="presupuesto_min" type="number" min="0" step="0.01" placeholder="2000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-pmax">Presupuesto Max (€/mes)</Label>
                  <Input id="o-pmax" name="presupuesto_max" type="number" min="0" step="0.01" placeholder="8000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="o-smin">Superficie Min (m²)</Label>
                  <Input id="o-smin" name="superficie_min" type="number" min="0" placeholder="100" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-smax">Superficie Max (m²)</Label>
                  <Input id="o-smax" name="superficie_max" type="number" min="0" placeholder="500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="o-cn">Contacto</Label>
                  <Input id="o-cn" name="contacto_nombre" placeholder="Juan García" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-ce">Email</Label>
                  <Input id="o-ce" name="contacto_email" type="email" placeholder="juan@marca.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-ct">Teléfono</Label>
                  <Input id="o-ct" name="contacto_telefono" placeholder="+34 600..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-desc">Descripción</Label>
                <Textarea id="o-desc" name="descripcion" placeholder="Detalles sobre el operador..." rows={3} />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                {submitting ? "Creando..." : "Crear Operador"}
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
                placeholder="Buscar por nombre, sector o contacto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroSector} onValueChange={setFiltroSector}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los sectores</SelectItem>
                {SECTORES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroActivo} onValueChange={setFiltroActivo}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="activo">Activos</SelectItem>
                <SelectItem value="inactivo">Inactivos</SelectItem>
              </SelectContent>
            </Select>
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
              <p className="text-muted-foreground">
                {search || filtroSector !== "todos" || filtroActivo !== "todos"
                  ? "No se encontraron operadores con esos filtros."
                  : "No hay operadores. Crea el primero."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Presupuesto</TableHead>
                  <TableHead className="text-right">Superficie</TableHead>
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
                      {o.contacto_nombre && (
                        <p className="text-xs text-muted-foreground">{o.contacto_nombre}</p>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{o.sector || "—"}</Badge></TableCell>
                    <TableCell className="text-right">
                      {Number(o.presupuesto_min).toLocaleString("es-ES")} – {Number(o.presupuesto_max).toLocaleString("es-ES")} €
                    </TableCell>
                    <TableCell className="text-right">
                      {o.superficie_min} – {o.superficie_max} m²
                    </TableCell>
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
          {!loading && operadores.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{operadores.length} operador{operadores.length !== 1 ? "es" : ""} encontrado{operadores.length !== 1 ? "s" : ""}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
