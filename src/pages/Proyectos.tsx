import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FolderKanban, Calendar, MapPin, Building2, ClipboardCheck, Layers, ArrowLeftRight, Pill, ShoppingBag, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const tipoLabels: Record<string, string> = {
  comercializacion: "Comercialización",
  negociacion: "Negociación",
  centro_completo: "Centro Completo",
  auditoria_estrategica: "Auditoría Estratégica",
  desarrollo_suelo: "Desarrollo Suelo",
  traspaso_adquisicion: "Traspaso/Adquisición",
  farmacia: "Farmacia",
  otro: "Otro",
};

const tipoIcons: Record<string, any> = {
  comercializacion: Building2,
  centro_completo: Building2,
  auditoria_estrategica: ClipboardCheck,
  desarrollo_suelo: Layers,
  traspaso_adquisicion: ArrowLeftRight,
  farmacia: Pill,
};

const estadoLabels: Record<string, string> = {
  borrador: "Borrador",
  activo: "Activo",
  en_pausa: "En pausa",
  en_negociacion: "En negociación",
  cerrado_exito: "Cerrado ✓",
  cerrado_sin_exito: "Cerrado ✗",
  archivado: "Archivado",
};

const estadoColors: Record<string, string> = {
  borrador: "bg-muted text-muted-foreground",
  activo: "bg-chart-2/10 text-chart-2",
  en_pausa: "bg-chart-3/10 text-chart-3",
  en_negociacion: "bg-chart-3/10 text-chart-3",
  cerrado_exito: "bg-accent/10 text-accent",
  cerrado_sin_exito: "bg-destructive/10 text-destructive",
  archivado: "bg-muted text-muted-foreground",
};

const tipoColors: Record<string, string> = {
  comercializacion: "bg-accent/10 text-accent",
  negociacion: "bg-chart-3/10 text-chart-3",
  centro_completo: "bg-accent/10 text-accent",
  auditoria_estrategica: "bg-chart-5/10 text-chart-5",
  desarrollo_suelo: "bg-chart-2/10 text-chart-2",
  traspaso_adquisicion: "bg-chart-3/10 text-chart-3",
  farmacia: "bg-destructive/10 text-destructive",
  otro: "bg-muted text-muted-foreground",
};

export default function Proyectos() {
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchProyectos = async () => {
    setLoading(true);
    let query = supabase
      .from("proyectos")
      .select("*")
      .order("created_at", { ascending: false });
    if (filtroEstado !== "todos") query = query.eq("estado", filtroEstado as any);
    if (filtroTipo !== "todos") query = query.eq("tipo", filtroTipo as any);
    if (search) query = query.or(`nombre.ilike.%${search}%,descripcion.ilike.%${search}%`);
    const { data } = await query;
    setProyectos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProyectos(); }, [filtroEstado, filtroTipo, search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("proyectos").insert({
      nombre: fd.get("nombre") as string,
      descripcion: (fd.get("descripcion") as string) || null,
      tipo: fd.get("tipo") as any,
      ubicacion: (fd.get("ubicacion") as string) || null,
      codigo_postal: (fd.get("codigo_postal") as string) || null,
      presupuesto_estimado: fd.get("presupuesto_estimado") ? Number(fd.get("presupuesto_estimado")) : null,
      fecha_objetivo: (fd.get("fecha_objetivo") as string) || null,
      created_by: user?.id,
      responsable_id: user?.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al crear proyecto", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Proyecto creado correctamente" });
      setDialogOpen(false);
      fetchProyectos();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">Gestiona todas las operaciones comerciales</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Proyecto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-nombre">Nombre del proyecto *</Label>
                <Input id="p-nombre" name="nombre" placeholder="CC Vallecas — Comercialización" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-tipo">Tipo *</Label>
                  <Select name="tipo" defaultValue="comercializacion">
                    <SelectTrigger id="p-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(tipoLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-fecha">Fecha objetivo</Label>
                  <Input id="p-fecha" name="fecha_objetivo" type="date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-ubicacion">Ubicación</Label>
                  <Input id="p-ubicacion" name="ubicacion" placeholder="Madrid Sur" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-cp">Código Postal</Label>
                  <Input id="p-cp" name="codigo_postal" placeholder="28001" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-presupuesto">Presupuesto estimado (€)</Label>
                <Input id="p-presupuesto" name="presupuesto_estimado" type="number" placeholder="500000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-desc">Descripción</Label>
                <Textarea id="p-desc" name="descripcion" placeholder="Objetivo y contexto del proyecto..." rows={3} />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                {submitting ? "Creando..." : "Crear Proyecto"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar proyectos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {Object.entries(tipoLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {Object.entries(estadoLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Project cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full rounded-lg" />)}
        </div>
      ) : proyectos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FolderKanban className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {search || filtroEstado !== "todos" || filtroTipo !== "todos"
                ? "No se encontraron proyectos con esos filtros."
                : "No hay proyectos aún. Crea el primero."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((p) => {
            const TipoIcon = tipoIcons[p.tipo] || FolderKanban;
            return (
              <Link key={p.id} to={`/proyectos/${p.id}`}>
                <Card className="hover:border-accent/50 hover:shadow-md transition-all cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <TipoIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <h3 className="font-semibold leading-tight line-clamp-2">{p.nombre}</h3>
                      </div>
                      <Badge variant="secondary" className={`shrink-0 text-xs ${estadoColors[p.estado] || ""}`}>
                        {estadoLabels[p.estado] || p.estado}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Badge variant="outline" className={`text-xs ${tipoColors[p.tipo] || ""}`}>
                      {tipoLabels[p.tipo] || p.tipo}
                    </Badge>
                    {p.descripcion && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{p.descripcion}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {p.ubicacion && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {p.ubicacion}
                        </span>
                      )}
                      {p.fecha_objetivo && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(p.fecha_objetivo).toLocaleDateString("es-ES")}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      {!loading && proyectos.length > 0 && (
        <p className="text-xs text-muted-foreground">{proyectos.length} proyecto{proyectos.length !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
