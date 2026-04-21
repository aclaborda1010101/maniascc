import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useIsMobile } from "@/hooks/use-mobile";

const SECTORES: { value: string; label: string }[] = [
  { value: "Alimentación", label: "Alimentación" },
  { value: "Moda", label: "Moda" },
  { value: "Restauración", label: "Restauración" },
  { value: "Hogar", label: "Hogar" },
  { value: "Electrónica", label: "Electrónica" },
  { value: "Belleza", label: "Belleza" },
  { value: "Deportes", label: "Deportes" },
  { value: "Salud", label: "Salud" },
  { value: "Servicios", label: "Servicios" },
  { value: "Ocio", label: "Ocio" },
  { value: "Financiero", label: "Financiero" },
  { value: "Otro", label: "Otro" },
];

export default function Operadores() {
  const [search, setSearch] = useState("");
  const [filtroSector, setFiltroSector] = useState("todos");
  const [filtroActivo, setFiltroActivo] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [matrizMode, setMatrizMode] = useState<"existing" | "new">("existing");
  const [selectedMatrizId, setSelectedMatrizId] = useState("");
  const [selectedActivoId, setSelectedActivoId] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const qc = useQueryClient();

  const { data: operadores = [], isLoading: loading } = useQuery({
    queryKey: ["operadores", search, filtroSector, filtroActivo],
    queryFn: async () => {
      let query = supabase.from("operadores").select("*").order("created_at", { ascending: false });
      if (search) query = query.or(`nombre.ilike.%${search}%,sector.ilike.%${search}%`);
      if (filtroSector !== "todos") query = query.eq("sector", filtroSector);
      if (filtroActivo === "activo") query = query.eq("activo", true);
      if (filtroActivo === "inactivo") query = query.eq("activo", false);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: activos = [] } = useQuery({
    queryKey: ["operadores-activos-list"],
    queryFn: async () => {
      const { data } = await supabase.from("locales").select("id, nombre, direccion").order("nombre");
      return data || [];
    },
  });

  const matrices = (operadores as any[]).filter((o: any) => !o.matriz_id);
  const selectedMatriz = matrices.find((m: any) => m.id === selectedMatrizId);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const matrizId = matrizMode === "existing" && selectedMatrizId ? selectedMatrizId : null;
    const sector = matrizMode === "existing" && selectedMatriz ? selectedMatriz.sector : (fd.get("sector") as string);
    const { error } = await supabase.from("operadores").insert({
      nombre: fd.get("nombre") as string,
      sector,
      direccion: (fd.get("direccion") as string) || null,
      presupuesto_min: Number(fd.get("presupuesto_min")) || 0,
      presupuesto_max: Number(fd.get("presupuesto_max")) || 0,
      superficie_min: Number(fd.get("superficie_min")) || 0,
      superficie_max: Number(fd.get("superficie_max")) || 0,
      descripcion: (fd.get("descripcion") as string) || null,
      created_by: user?.id,
      matriz_id: matrizId,
      activo_id: selectedActivoId && selectedActivoId !== "none" ? selectedActivoId : null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al crear operador", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Operador creado correctamente" });
      setDialogOpen(false);
      setSelectedMatrizId("");
      setSelectedActivoId("");
      setMatrizMode("existing");
      qc.invalidateQueries({ queryKey: ["operadores"] });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Operadores</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Gestiona los operadores comerciales</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Operador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Crear Nuevo Operador</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Matriz</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={matrizMode === "existing" ? "default" : "outline"} onClick={() => setMatrizMode("existing")}>Matriz existente</Button>
                  <Button type="button" size="sm" variant={matrizMode === "new" ? "default" : "outline"} onClick={() => { setMatrizMode("new"); setSelectedMatrizId(""); }}>Es nueva matriz</Button>
                </div>
                {matrizMode === "existing" && (
                  <Select value={selectedMatrizId} onValueChange={setSelectedMatrizId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar matriz..." /></SelectTrigger>
                    <SelectContent>{matrices.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {matrizMode === "new" && <p className="text-xs text-muted-foreground">Este operador será una nueva matriz.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-nombre">Nombre identificativo *</Label>
                <Input id="o-nombre" name="nombre" placeholder="Ej: Mercadona Norte" required />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input name="direccion" placeholder="Calle, número, ciudad" />
              </div>
              <div className="space-y-2">
                <Label>Sector {matrizMode === "existing" && selectedMatriz ? "(heredado)" : "*"}</Label>
                {matrizMode === "existing" && selectedMatriz ? (
                  <Input value={selectedMatriz.sector} disabled className="bg-muted" />
                ) : (
                  <select name="sector" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Seleccionar sector</option>
                    {SECTORES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Activo vinculado (opcional)</Label>
                <Select value={selectedActivoId} onValueChange={setSelectedActivoId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar activo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {activos.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre} — {a.direccion}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Presupuesto Min (€/mes)</Label><Input name="presupuesto_min" type="number" min="0" step="0.01" /></div>
                <div className="space-y-2"><Label>Presupuesto Max (€/mes)</Label><Input name="presupuesto_max" type="number" min="0" step="0.01" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Superficie Min (m²)</Label><Input name="superficie_min" type="number" min="0" /></div>
                <div className="space-y-2"><Label>Superficie Max (m²)</Label><Input name="superficie_max" type="number" min="0" /></div>
              </div>
              <div className="space-y-2"><Label>Descripción</Label><Textarea name="descripcion" rows={3} /></div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                {submitting ? "Creando..." : "Crear Operador"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o sector..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-2">
              <Select value={filtroSector} onValueChange={setFiltroSector}>
                <SelectTrigger className="flex-1 sm:w-[160px]"><SelectValue placeholder="Sector" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los sectores</SelectItem>
                  {SECTORES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroActivo} onValueChange={setFiltroActivo}>
                <SelectTrigger className="flex-1 sm:w-[130px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : operadores.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">{search || filtroSector !== "todos" || filtroActivo !== "todos" ? "No se encontraron operadores." : "No hay operadores. Crea el primero."}</p>
            </div>
          ) : isMobile ? (
            /* Mobile: card layout */
            <div className="space-y-2">
              {operadores.map((o) => (
                <Link key={o.id} to={`/operadores/${o.id}`}>
                  <Card className="hover:border-accent/40 transition-colors shadow-sm">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-accent truncate">{o.nombre}</p>
                          {o.direccion && <p className="text-[11px] text-muted-foreground truncate">{o.direccion}</p>}
                        </div>
                        <Badge variant={o.activo ? "default" : "secondary"} className={`shrink-0 text-[10px] ${o.activo ? "bg-chart-2/10 text-chart-2" : ""}`}>
                          {o.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">{o.sector || "—"}</Badge>
                        {!o.matriz_id && <Badge variant="outline" className="text-[10px]">Matriz</Badge>}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {Number(o.presupuesto_min).toLocaleString("es-ES")}–{Number(o.presupuesto_max).toLocaleString("es-ES")} €
                        </span>
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
                  <TableHead>Matriz</TableHead>
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
                      <Link to={`/operadores/${o.id}`} className="font-medium text-accent hover:underline">{o.nombre}</Link>
                      {o.direccion && <p className="text-xs text-muted-foreground">{o.direccion}</p>}
                    </TableCell>
                    <TableCell>
                      {o.matriz_id ? (
                        <Link to={`/operadores/${o.matriz_id}`} className="text-xs text-accent hover:underline">
                          {matrices.find((m: any) => m.id === o.matriz_id)?.nombre || "—"}
                        </Link>
                      ) : (
                        <Badge variant="outline" className="text-xs">Matriz</Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{o.sector || "—"}</Badge></TableCell>
                    <TableCell className="text-right">{Number(o.presupuesto_min).toLocaleString("es-ES")} – {Number(o.presupuesto_max).toLocaleString("es-ES")} €</TableCell>
                    <TableCell className="text-right">{o.superficie_min} – {o.superficie_max} m²</TableCell>
                    <TableCell>
                      <Badge variant={o.activo ? "default" : "secondary"} className={o.activo ? "bg-chart-2/10 text-chart-2" : ""}>{o.activo ? "Activo" : "Inactivo"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && operadores.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{operadores.length} operador{operadores.length !== 1 ? "es" : ""}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
