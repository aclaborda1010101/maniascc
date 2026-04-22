import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FolderKanban, Calendar, MapPin, Building2, ClipboardCheck, Layers, ArrowLeftRight, ShoppingBag, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const tipoLabels: Record<string, string> = {
  desarrollo_comercial: "Desarrollo Comercial",
  venta_activo: "Venta de Activo",
  optimizacion_centros: "Optimización de Centros",
  comercializacion: "Comercialización",
  negociacion: "Negociación",
  centro_completo: "Centro Completo",
  auditoria_estrategica: "Auditoría Estratégica",
  desarrollo_suelo: "Desarrollo Suelo",
  traspaso_adquisicion: "Traspaso/Adquisición",
  otro: "Otro",
};

const tipoIcons: Record<string, any> = {
  desarrollo_comercial: ShoppingBag,
  venta_activo: Building2,
  optimizacion_centros: TrendingUp,
  comercializacion: Building2,
  centro_completo: Building2,
  auditoria_estrategica: ClipboardCheck,
  desarrollo_suelo: Layers,
  traspaso_adquisicion: ArrowLeftRight,
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

// Estado dot color (uses --acc-* tokens)
const estadoDot: Record<string, string> = {
  borrador: "hsl(var(--muted-foreground))",
  activo: "hsl(var(--acc-4))",
  en_pausa: "hsl(var(--acc-5))",
  en_negociacion: "hsl(var(--acc-2))",
  cerrado_exito: "hsl(var(--acc-4))",
  cerrado_sin_exito: "hsl(var(--destructive))",
  archivado: "hsl(var(--muted-foreground))",
};

const tipoColors: Record<string, string> = {
  desarrollo_comercial: "bg-[hsl(var(--acc-1))/0.12] text-[hsl(var(--acc-1))] border-[hsl(var(--acc-1))/0.25]",
  venta_activo: "bg-[hsl(var(--acc-2))/0.12] text-[hsl(var(--acc-2))] border-[hsl(var(--acc-2))/0.25]",
  optimizacion_centros: "bg-[hsl(var(--acc-4))/0.12] text-[hsl(var(--acc-4))] border-[hsl(var(--acc-4))/0.25]",
  comercializacion: "bg-[hsl(var(--acc-2))/0.12] text-[hsl(var(--acc-2))] border-[hsl(var(--acc-2))/0.25]",
  negociacion: "bg-[hsl(var(--acc-3))/0.12] text-[hsl(var(--acc-3))] border-[hsl(var(--acc-3))/0.25]",
  centro_completo: "bg-[hsl(var(--acc-3))/0.12] text-[hsl(var(--acc-3))] border-[hsl(var(--acc-3))/0.25]",
  auditoria_estrategica: "bg-[hsl(var(--acc-5))/0.12] text-[hsl(var(--acc-5))] border-[hsl(var(--acc-5))/0.25]",
  desarrollo_suelo: "bg-[hsl(var(--acc-4))/0.12] text-[hsl(var(--acc-4))] border-[hsl(var(--acc-4))/0.25]",
  traspaso_adquisicion: "bg-[hsl(var(--acc-1))/0.12] text-[hsl(var(--acc-1))] border-[hsl(var(--acc-1))/0.25]",
  otro: "bg-white/5 text-muted-foreground border-white/10",
};

const subtiposActivo = [
  "Gasolinera", "Local", "Suelo", "Edificio", "Centro Comercial", "Parque de Medianas",
];

const tiposNuevos = ["desarrollo_comercial", "venta_activo", "optimizacion_centros"];

export default function Proyectos() {
  const [tipoSeleccionado, setTipoSeleccionado] = useState("desarrollo_comercial");
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
      .select("id,nombre,descripcion,tipo,estado,ubicacion,fecha_objetivo,created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (filtroEstado !== "todos") query = query.eq("estado", filtroEstado as any);
    if (filtroTipo !== "todos") query = query.eq("tipo", filtroTipo as any);
    if (search) query = query.or(`nombre.ilike.%${search}%,descripcion.ilike.%${search}%`);
    const { data } = await query;
    setProyectos(data || []);
    setLoading(false);
  };

  // Debounce search to avoid one query per keystroke
  useEffect(() => {
    const t = setTimeout(() => { fetchProyectos(); }, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [filtroEstado, filtroTipo, search]);

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
      toast({ title: "Error al crear oportunidad", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Oportunidad creada correctamente" });
      setDialogOpen(false);
      fetchProyectos();
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 relative">
      {/* Header — eyebrow + huge title + iridescent CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--acc-4))", boxShadow: "0 0 8px hsl(var(--acc-4))" }} />
            Pipeline · {proyectos.length}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-display">Oportunidades</h1>
          <p className="text-sm text-muted-foreground">Gestiona todas las oportunidades de negocio</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="pill-iridescent inline-flex items-center gap-2 px-5 h-11 rounded-2xl font-medium text-sm w-full sm:w-auto justify-center transition-transform hover:scale-[1.02]">
              <Plus className="h-4 w-4" /> Nueva oportunidad
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Crear Nueva Oportunidad</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-nombre">Nombre de la oportunidad *</Label>
                <Input id="p-nombre" name="nombre" placeholder="CC Vallecas — Desarrollo Comercial" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-tipo">Tipo *</Label>
                  <Select name="tipo" defaultValue="desarrollo_comercial" onValueChange={setTipoSeleccionado}>
                    <SelectTrigger id="p-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiposNuevos.map((k) => <SelectItem key={k} value={k}>{tipoLabels[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-fecha">Fecha objetivo</Label>
                  <Input id="p-fecha" name="fecha_objetivo" type="date" />
                </div>
              </div>
              {tipoSeleccionado === "venta_activo" && (
                <div className="space-y-2">
                  <Label htmlFor="p-subtipo">Subtipo de activo</Label>
                  <Select name="subtipo_activo">
                    <SelectTrigger id="p-subtipo"><SelectValue placeholder="Seleccionar subtipo" /></SelectTrigger>
                    <SelectContent>
                      {subtiposActivo.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Textarea id="p-desc" name="descripcion" placeholder="Objetivo y contexto de la oportunidad..." rows={3} />
              </div>
              <button type="submit" className="pill-iridescent w-full h-11 rounded-2xl text-sm font-medium" disabled={submitting}>
                {submitting ? "Creando..." : "Crear oportunidad"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Buscador glass */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <input
          placeholder="Buscar oportunidades..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-glass w-full pl-11 h-12 text-sm placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Filtro estado — Select en móvil, chips en desktop */}
      <div className="sm:hidden">
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-full h-11 rounded-2xl bg-white/[0.04] border-white/10">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="activo">Activas</SelectItem>
            <SelectItem value="en_negociacion">Negociación</SelectItem>
            <SelectItem value="en_pausa">En pausa</SelectItem>
            <SelectItem value="cerrado_exito">Cerradas ✓</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="hidden sm:flex gap-2 flex-wrap">
        {[
          { value: "todos", label: "Todas" },
          { value: "activo", label: "Activas" },
          { value: "en_negociacion", label: "Negociación" },
          { value: "en_pausa", label: "En pausa" },
          { value: "cerrado_exito", label: "Cerradas ✓" },
        ].map((chip) => {
          const active = filtroEstado === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setFiltroEstado(chip.value)}
              className={
                active
                  ? "pill-iridescent shrink-0 px-5 py-2 rounded-full text-xs font-medium"
                  : "shrink-0 px-5 py-2 rounded-full text-xs font-medium border border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
              }
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
        </div>
      ) : proyectos.length === 0 ? (
        <div className="glass p-16 text-center">
          <FolderKanban className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">
            {search || filtroEstado !== "todos" || filtroTipo !== "todos"
              ? "No se encontraron oportunidades con esos filtros."
              : "No hay oportunidades aún. Crea la primera."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((p) => {
            const TipoIcon = tipoIcons[p.tipo] || FolderKanban;
            const dotColor = estadoDot[p.estado] || "hsl(var(--muted-foreground))";
            return (
              <Link key={p.id} to={`/oportunidades/${p.id}`}>
                <div className="glass-edge p-5 hover:bg-white/[0.06] transition-all cursor-pointer h-full flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <TipoIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <h3 className="font-display font-semibold leading-tight tracking-tight line-clamp-2 text-base">{p.nombre}</h3>
                    </div>
                    <span className="chip shrink-0 inline-flex items-center gap-1.5">
                      <span className="chip-dot" style={{ background: dotColor }} />
                      {estadoLabels[p.estado] || p.estado}
                    </span>
                  </div>
                  <span className={`chip ${tipoColors[p.tipo] || ""} self-start`}>{tipoLabels[p.tipo] || p.tipo}</span>
                  {p.descripcion && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{p.descripcion}</p>
                  )}
                  <div className="mt-auto flex items-center gap-3 md:gap-4 text-[10px] md:text-xs text-muted-foreground flex-wrap pt-2 border-t border-white/5">
                    {p.ubicacion && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {p.ubicacion}
                      </span>
                    )}
                    {p.fecha_objetivo && (
                      <span className="flex items-center gap-1 num-display">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.fecha_objetivo).toLocaleDateString("es-ES")}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {!loading && proyectos.length > 0 && (
        <p className="text-xs text-muted-foreground">{proyectos.length} oportunidad{proyectos.length !== 1 ? "es" : ""}</p>
      )}
    </div>
  );
}
