import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Plus, Search, Star, MessageCircle, Mic, Users, Heart, Upload, Building2, Network, ArrowLeft, Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import ImportContactosModal from "@/components/contactos/ImportContactosModal";
import { ImportEmailsModal } from "@/components/contactos/ImportEmailsModal";
import CreateContactForm from "@/components/contactos/CreateContactForm";
import ContactDetailPanel from "@/components/contactos/ContactDetailPanel";

const TIPOS = [
  { value: "todos", label: "Todos" },
  { value: "operador", label: "Operador" },
  { value: "propietario", label: "Propietario" },
];

const CATEGORIAS = [
  { value: "todos", label: "Todos" },
  { value: "profesional", label: "Profesional" },
];

export default function Contactos() {
  const [contactos, setContactos] = useState<any[]>([]);
  const [operadores, setOperadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [catFilter, setCatFilter] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const fetchContactos = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("contactos").select("*").order("created_at", { ascending: false });
    if (search) {
      query = query.or(`nombre.ilike.%${search}%,empresa.ilike.%${search}%,cargo.ilike.%${search}%`);
    }
    const { data } = await query;
    setContactos(data || []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    supabase.from("operadores").select("id, nombre").eq("activo", true).order("nombre")
      .then(({ data }) => setOperadores(data || []));
  }, []);

  useEffect(() => { fetchContactos(); }, [fetchContactos]);

  const filtered = useMemo(() => {
    let list = contactos;
    if (tipoFilter !== "todos") {
      list = list.filter((c) => {
        const cargo = (c.cargo || "").toLowerCase();
        if (tipoFilter === "operador") return c.operador_id || cargo.includes("operador");
        if (tipoFilter === "propietario") return cargo.includes("propietario") || cargo.includes("owner");
        return true;
      });
    }
    if (catFilter !== "todos") {
      list = list.filter((c) => {
        if (catFilter === "profesional") return !!c.empresa;
        return true;
      });
    }
    return list;
  }, [contactos, tipoFilter, catFilter]);

  const inNetworkCount = contactos.filter((c) => c.in_network).length;
  const favCount = contactos.filter((c) => c.is_favorite).length;
  const selected = contactos.find((c) => c.id === selectedId) || null;

  const toggleFav = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const c = contactos.find((x) => x.id === id);
    if (!c) return;
    const next = !c.is_favorite;
    setContactos((prev) => prev.map((x) => x.id === id ? { ...x, is_favorite: next } : x));
    await supabase.from("contactos").update({ is_favorite: next } as any).eq("id", id);
  };

  const toggleNetwork = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const c = contactos.find((x) => x.id === id);
    if (!c) return;
    const next = !c.in_network;
    setContactos((prev) => prev.map((x) => x.id === id ? { ...x, in_network: next } : x));
    await supabase.from("contactos").update({ in_network: next } as any).eq("id", id);
  };

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
      toast({ title: "Contacto creado" });
      setDialogOpen(false);
      fetchContactos();
    }
  };

  const listPanel = (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="border-b p-3 md:p-4 space-y-2.5 md:space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base md:text-lg font-bold tracking-tight">Red de Contactos</h1>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nuevo Contacto</DialogTitle></DialogHeader>
                <CreateContactForm operadores={operadores} submitting={submitting} onSubmit={handleCreate} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 text-[10px] md:text-xs font-medium">
          <span className="flex items-center gap-1 text-primary">
            <Network className="h-3 w-3 md:h-3.5 md:w-3.5" /> {inNetworkCount} EN RED
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="flex items-center gap-1 text-chart-3">
            <Star className="h-3 w-3 md:h-3.5 md:w-3.5" /> {favCount} FAV
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{contactos.length} TOTAL</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar contacto..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-1 p-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">Sin contactos</p>
          </div>
        ) : (
          <div className="space-y-0.5 p-1">
            {filtered.map((c) => (
              <ContactListItem
                key={c.id}
                contacto={c}
                isSelected={selectedId === c.id}
                onSelect={() => setSelectedId(c.id)}
                onToggleFav={toggleFav}
                onToggleNetwork={toggleNetwork}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const detailContent = selected ? (
    <div className="h-full overflow-y-auto">
      {isMobile && (
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-3 py-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium truncate">{selected.nombre} {selected.apellidos || ""}</span>
        </div>
      )}
      <ContactDetailPanel contacto={selected} onRefresh={fetchContactos} />
    </div>
  ) : (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <Network className="mb-3 h-12 w-12 text-muted-foreground/20" />
      <p className="text-sm text-muted-foreground">Selecciona un contacto para ver su ficha</p>
    </div>
  );

  // Mobile: full-screen list, detail as Sheet
  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] -mx-4 -mt-4">
        {listPanel}
        <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
          <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-xl">
            {detailContent}
          </SheetContent>
        </Sheet>
        <ImportContactosModal open={importOpen} onOpenChange={setImportOpen} onImported={fetchContactos} />
      </div>
    );
  }

  // Desktop: two-panel
  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden -m-6">
      <div className="w-[380px] shrink-0 border-r">
        {listPanel}
      </div>
      <div className="flex-1 overflow-y-auto bg-background">
        {detailContent}
      </div>
      <ImportContactosModal open={importOpen} onOpenChange={setImportOpen} onImported={fetchContactos} />
    </div>
  );
}

/* ─── List Item ─── */
function ContactListItem({ contacto: c, isSelected, onSelect, onToggleFav, onToggleNetwork }: {
  contacto: any; isSelected: boolean;
  onSelect: () => void;
  onToggleFav: (id: string, e: React.MouseEvent) => void;
  onToggleNetwork: (id: string, e: React.MouseEvent) => void;
}) {
  const initials = `${(c.nombre || "?")[0]}${(c.apellidos || "")[0] || ""}`.toUpperCase();
  const daysSince = c.last_contact
    ? Math.floor((Date.now() - new Date(c.last_contact).getTime()) / 86400000)
    : null;

  return (
    <div
      onClick={onSelect}
      className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors min-h-[44px] ${
        isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
      }`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        c.in_network ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
      }`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{c.nombre} {c.apellidos || ""}</span>
          {c.in_network && <Network className="h-3 w-3 text-primary shrink-0" />}
        </div>
        {(c.cargo || c.empresa) && (
          <p className="text-[11px] text-muted-foreground truncate">
            {c.cargo}{c.cargo && c.empresa ? " · " : ""}{c.empresa}
          </p>
        )}
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {(c.wa_message_count > 0 || c.whatsapp) && (
            <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[9px] bg-chart-2/10 text-chart-2 border-chart-2/20">
              <MessageCircle className="h-2.5 w-2.5" />
              {c.wa_message_count > 0 ? c.wa_message_count : "WA"}
            </Badge>
          )}
          {c.plaud_count > 0 && (
            <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[9px] bg-chart-3/10 text-chart-3 border-chart-3/20">
              <Mic className="h-2.5 w-2.5" /> {c.plaud_count}
            </Badge>
          )}
          {daysSince !== null && (
            <span className={`ml-auto text-[9px] font-medium ${
              daysSince <= 7 ? "text-chart-2" : daysSince <= 30 ? "text-chart-3" : "text-muted-foreground"
            }`}>
              {daysSince === 0 ? "hoy" : `${daysSince}d`}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={(e) => onToggleFav(c.id, e)} className="p-0.5 rounded hover:bg-muted transition-colors min-h-[44px] min-w-[32px] flex items-center justify-center">
          <Star className={`h-3.5 w-3.5 ${c.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
        </button>
      </div>
    </div>
  );
}
