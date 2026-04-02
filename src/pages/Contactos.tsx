import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Star, MessageCircle, Mic, Phone, Mail,
  Building2, Upload, Users, Heart, Filter,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ImportContactosModal from "@/components/contactos/ImportContactosModal";

const estiloLabels: Record<string, string> = {
  colaborativo: "Colaborativo",
  competitivo: "Competitivo",
  analitico: "Analítico",
  expresivo: "Expresivo",
  evitador: "Evitador",
};

const estiloColors: Record<string, string> = {
  colaborativo: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  competitivo: "bg-destructive/10 text-destructive border-destructive/20",
  analitico: "bg-primary/10 text-primary border-primary/20",
  expresivo: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  evitador: "bg-muted text-muted-foreground border-muted",
};

const TIPOS = [
  { value: "todos", label: "Todos" },
  { value: "operador", label: "Operador" },
  { value: "propietario", label: "Propietario" },
  { value: "agente", label: "Agente" },
];

const CATEGORIAS = [
  { value: "todos", label: "Todos" },
  { value: "profesional", label: "Profesional" },
  { value: "personal", label: "Personal" },
];

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function Contactos() {
  const navigate = useNavigate();
  const [contactos, setContactos] = useState<any[]>([]);
  const [operadores, setOperadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [catFilter, setCatFilter] = useState("todos");
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("contactos_favs");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchContactos = async () => {
    setLoading(true);
    let query = supabase.from("contactos").select("*").order("created_at", { ascending: false });
    if (search) {
      query = query.or(`nombre.ilike.%${search}%,empresa.ilike.%${search}%,cargo.ilike.%${search}%`);
    }
    const { data } = await query;
    setContactos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    supabase
      .from("operadores")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setOperadores(data || []));
  }, []);

  useEffect(() => {
    fetchContactos();
  }, [search]);

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("contactos_favs", JSON.stringify([...next]));
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = contactos;
    if (tipoFilter !== "todos") {
      list = list.filter((c) => {
        const cargo = (c.cargo || "").toLowerCase();
        if (tipoFilter === "operador") return c.operador_id || cargo.includes("operador");
        if (tipoFilter === "propietario") return cargo.includes("propietario") || cargo.includes("owner");
        if (tipoFilter === "agente") return cargo.includes("agente") || cargo.includes("agent") || cargo.includes("comercial");
        return true;
      });
    }
    if (catFilter !== "todos") {
      list = list.filter((c) => {
        if (catFilter === "profesional") return !!c.empresa;
        if (catFilter === "personal") return !c.empresa;
        return true;
      });
    }
    return list;
  }, [contactos, tipoFilter, catFilter]);

  const favCount = contactos.filter((c) => favorites.has(c.id)).length;

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const estilo = fd.get("estilo_negociacion") as string;
    const opId = fd.get("operador_id") as string;
    const { error } = await supabase.from("contactos").insert({
      nombre: fd.get("nombre") as string,
      apellidos: (fd.get("apellidos") as string) || null,
      empresa: (fd.get("empresa") as string) || null,
      cargo: (fd.get("cargo") as string) || null,
      email: (fd.get("email") as string) || null,
      telefono: (fd.get("telefono") as string) || null,
      whatsapp: (fd.get("whatsapp") as string) || null,
      linkedin_url: (fd.get("linkedin_url") as string) || null,
      estilo_negociacion: estilo && estilo !== "none" ? estilo : null,
      operador_id: opId && opId !== "none" ? opId : null,
      notas_perfil: (fd.get("notas_perfil") as string) || null,
      creado_por: user?.id,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al crear contacto", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contacto creado correctamente" });
      setDialogOpen(false);
      fetchContactos();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Red de Contactos</h1>
          <p className="text-sm text-muted-foreground">Tu red estratégica de relaciones profesionales</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Importar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="mr-1.5 h-4 w-4" /> Nuevo Contacto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Crear Nuevo Contacto</DialogTitle></DialogHeader>
              <CreateContactForm
                operadores={operadores}
                submitting={submitting}
                onSubmit={handleCreate}
              />
            </DialogContent>
          </Dialog>
          <ImportContactosModal open={importOpen} onOpenChange={setImportOpen} onImported={fetchContactos} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Total" value={contactos.length} />
        <StatCard icon={Heart} label="Favoritos" value={favCount} color="text-destructive" />
        <StatCard icon={MessageCircle} label="Con WhatsApp" value={contactos.filter((c) => c.whatsapp).length} color="text-chart-2" />
        <StatCard icon={Building2} label="Con empresa" value={contactos.filter((c) => c.empresa).length} color="text-primary" />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, empresa o cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <FilterChips items={TIPOS} value={tipoFilter} onChange={setTipoFilter} />
          <FilterChips items={CATEGORIAS} value={catFilter} onChange={setCatFilter} />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">
            {search || tipoFilter !== "todos" || catFilter !== "todos"
              ? "No se encontraron contactos con esos filtros."
              : "No hay contactos aún. Crea el primero."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <ContactCard
                key={c.id}
                contacto={c}
                isFav={favorites.has(c.id)}
                onToggleFav={toggleFav}
                onClick={() => navigate(`/contactos/${c.id}`)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {filtered.length} contacto{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== contactos.length && ` de ${contactos.length}`}
          </p>
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg bg-muted p-2 ${color || "text-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChips({ items, value, onChange }: { items: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === item.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ContactCard({ contacto: c, isFav, onToggleFav, onClick }: {
  contacto: any;
  isFav: boolean;
  onToggleFav: (id: string, e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const days = daysSince(c.updated_at || c.created_at);
  const initials = `${(c.nombre || "?")[0]}${(c.apellidos || "")[0] || ""}`.toUpperCase();

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group relative"
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Top row: avatar + name + fav */}
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">
                {c.nombre} {c.apellidos || ""}
              </h3>
              {c.estilo_negociacion && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${estiloColors[c.estilo_negociacion] || ""}`}>
                  {estiloLabels[c.estilo_negociacion] || c.estilo_negociacion}
                </Badge>
              )}
            </div>
            {c.cargo && (
              <p className="text-xs text-muted-foreground truncate">{c.cargo}</p>
            )}
            {c.empresa && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <Building2 className="h-3 w-3 shrink-0" /> {c.empresa}
              </p>
            )}
          </div>
          <button
            onClick={(e) => onToggleFav(c.id, e)}
            className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <Star className={`h-4 w-4 ${isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
          </button>
        </div>

        {/* Badges row */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {c.whatsapp && (
            <Badge variant="secondary" className="gap-1 text-[10px] bg-chart-2/10 text-chart-2 border-chart-2/20">
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </Badge>
          )}
          {c.telefono && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Phone className="h-3 w-3" /> {c.telefono}
            </Badge>
          )}
          {c.email && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Mail className="h-3 w-3" /> Email
            </Badge>
          )}
          {days !== null && (
            <span className={`ml-auto text-[10px] font-medium ${
              days <= 7 ? "text-chart-2" : days <= 30 ? "text-chart-3" : "text-muted-foreground"
            }`}>
              {days === 0 ? "Hoy" : `hace ${days}d`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateContactForm({ operadores, submitting, onSubmit }: {
  operadores: any[];
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="c-nombre">Nombre *</Label>
          <Input id="c-nombre" name="nombre" placeholder="Ana" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-apellidos">Apellidos</Label>
          <Input id="c-apellidos" name="apellidos" placeholder="García López" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="c-empresa">Empresa</Label>
          <Input id="c-empresa" name="empresa" placeholder="Grupo XYZ" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-cargo">Cargo</Label>
          <Input id="c-cargo" name="cargo" placeholder="Dir. Comercial" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" name="email" type="email" placeholder="ana@empresa.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-tel">Teléfono</Label>
          <Input id="c-tel" name="telefono" placeholder="+34 600 000 000" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="c-whatsapp">WhatsApp</Label>
          <Input id="c-whatsapp" name="whatsapp" placeholder="+34 600 000 000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-linkedin">LinkedIn</Label>
          <Input id="c-linkedin" name="linkedin_url" placeholder="https://linkedin.com/in/..." />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-operador">Operador vinculado</Label>
        <Select name="operador_id" defaultValue="none">
          <SelectTrigger id="c-operador"><SelectValue placeholder="Sin operador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin operador</SelectItem>
            {operadores.map((op) => (
              <SelectItem key={op.id} value={op.id}>{op.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-estilo">Estilo de negociación</Label>
        <Select name="estilo_negociacion" defaultValue="none">
          <SelectTrigger id="c-estilo"><SelectValue placeholder="Sin definir" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin definir</SelectItem>
            <SelectItem value="colaborativo">Colaborativo</SelectItem>
            <SelectItem value="competitivo">Competitivo</SelectItem>
            <SelectItem value="analitico">Analítico</SelectItem>
            <SelectItem value="expresivo">Expresivo</SelectItem>
            <SelectItem value="evitador">Evitador</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-notas">Notas</Label>
        <Textarea id="c-notas" name="notas_perfil" placeholder="Observaciones sobre este contacto..." rows={2} />
      </div>
      <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
        {submitting ? "Creando..." : "Crear Contacto"}
      </Button>
    </form>
  );
}
