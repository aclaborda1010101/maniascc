import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickCreateContactDialog } from "@/components/QuickCreateContactDialog";
import {
  UserPlus, Plus, ChevronDown, ChevronRight, Building2, Mail, Phone, Users,
  MapPin, Link2, Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Props {
  operadorId: string;
}

export function OperadorContactosTab({ operadorId }: Props) {
  const { toast } = useToast();
  const [contactosMatriz, setContactosMatriz] = useState<any[]>([]);
  const [subdivisions, setSubdivisions] = useState<any[]>([]);
  const [subContacts, setSubContacts] = useState<Record<string, any[]>>({});
  const [subActivos, setSubActivos] = useState<Record<string, any[]>>({});
  const [allActivos, setAllActivos] = useState<any[]>([]);
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});

  // Dialog states
  const [showAddMatriz, setShowAddMatriz] = useState(false);
  const [showAddSubContact, setShowAddSubContact] = useState(false);
  const [showNewDir, setShowNewDir] = useState(false);
  const [showLinkActivo, setShowLinkActivo] = useState(false);
  const [showCreateActivo, setShowCreateActivo] = useState(false);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);

  const [newDirForm, setNewDirForm] = useState({ nombre: "", descripcion: "" });
  const [savingDir, setSavingDir] = useState(false);
  const [linkActivoId, setLinkActivoId] = useState("");
  const [newActivoForm, setNewActivoForm] = useState({ nombre: "", direccion: "", ciudad: "" });
  const [savingActivo, setSavingActivo] = useState(false);

  const fetchAll = async () => {
    const [cRes, sRes, aRes] = await Promise.all([
      supabase.from("contactos").select("*").eq("operador_id", operadorId).is("subdivision_id", null),
      supabase.from("operador_subdivisiones" as any).select("*").eq("operador_id", operadorId).order("created_at"),
      supabase.from("locales").select("id, nombre, direccion, ciudad").order("nombre"),
    ]);
    setContactosMatriz(cRes.data || []);
    setAllActivos(aRes.data || []);
    const subs = (sRes.data || []) as any[];
    setSubdivisions(subs);

    if (subs.length > 0) {
      const subIds = subs.map((s: any) => s.id);
      const [scRes, saRes] = await Promise.all([
        supabase.from("contactos").select("*").in("subdivision_id", subIds),
        supabase.from("subdivision_activos" as any).select("*").in("subdivision_id", subIds),
      ]);

      const groupedC: Record<string, any[]> = {};
      (scRes.data || []).forEach((c: any) => {
        if (!groupedC[c.subdivision_id]) groupedC[c.subdivision_id] = [];
        groupedC[c.subdivision_id].push(c);
      });
      setSubContacts(groupedC);

      // Fetch activo details for linked ones
      const activoIds = (saRes.data || []).map((sa: any) => sa.activo_id);
      let activoMap: Record<string, any> = {};
      if (activoIds.length > 0) {
        const { data: activosData } = await supabase.from("locales").select("id, nombre, direccion, ciudad").in("id", activoIds);
        (activosData || []).forEach((a: any) => { activoMap[a.id] = a; });
      }

      const groupedA: Record<string, any[]> = {};
      (saRes.data || []).forEach((sa: any) => {
        if (!groupedA[sa.subdivision_id]) groupedA[sa.subdivision_id] = [];
        const activo = activoMap[sa.activo_id];
        if (activo) groupedA[sa.subdivision_id].push({ ...activo, link_id: sa.id });
      });
      setSubActivos(groupedA);
    } else {
      setSubContacts({});
      setSubActivos({});
    }
  };

  useEffect(() => { fetchAll(); }, [operadorId]);

  const handleCreateDir = async () => {
    if (!newDirForm.nombre.trim()) return;
    setSavingDir(true);
    const { error } = await supabase.from("operador_subdivisiones" as any).insert({
      operador_id: operadorId,
      nombre: newDirForm.nombre,
      descripcion: newDirForm.descripcion || null,
    } as any);
    setSavingDir(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Dirección creada" });
      setNewDirForm({ nombre: "", descripcion: "" });
      setShowNewDir(false);
      fetchAll();
    }
  };

  const handleLinkActivo = async () => {
    if (!linkActivoId || !activeSubId) return;
    const { error } = await supabase.from("subdivision_activos" as any).insert({
      subdivision_id: activeSubId,
      activo_id: linkActivoId,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Activo vinculado" });
      setLinkActivoId("");
      setShowLinkActivo(false);
      fetchAll();
    }
  };

  const handleCreateActivo = async () => {
    if (!newActivoForm.nombre.trim() || !activeSubId) return;
    setSavingActivo(true);
    const { data, error } = await supabase.from("locales").insert({
      nombre: newActivoForm.nombre,
      direccion: newActivoForm.direccion || "",
      ciudad: newActivoForm.ciudad || "",
      codigo_postal: "",
    }).select("id").single();
    if (error || !data) {
      toast({ title: "Error", description: error?.message, variant: "destructive" });
      setSavingActivo(false);
      return;
    }
    await supabase.from("subdivision_activos" as any).insert({
      subdivision_id: activeSubId,
      activo_id: data.id,
    } as any);
    setSavingActivo(false);
    toast({ title: "Activo creado y vinculado" });
    setNewActivoForm({ nombre: "", direccion: "", ciudad: "" });
    setShowCreateActivo(false);
    fetchAll();
  };

  const handleUnlinkActivo = async (linkId: string) => {
    await supabase.from("subdivision_activos" as any).delete().eq("id", linkId);
    toast({ title: "Activo desvinculado" });
    fetchAll();
  };

  const ContactRow = ({ c }: { c: any }) => (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {c.nombre?.[0]}{c.apellidos?.[0] || ""}
        </div>
        <div>
          <Link to={`/contactos/${c.id}`} className="font-medium text-sm hover:underline">
            {c.nombre} {c.apellidos || ""}
          </Link>
          {c.cargo && <p className="text-xs text-muted-foreground">{c.cargo}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
        {c.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefono}</span>}
      </div>
    </div>
  );

  const ActivoRow = ({ a }: { a: any }) => (
    <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2">
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <Link to={`/activos/${a.id}`} className="text-sm font-medium hover:underline">{a.nombre}</Link>
        {a.ciudad && <span className="text-xs text-muted-foreground">— {a.ciudad}</span>}
      </div>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUnlinkActivo(a.link_id)}>
        <Trash2 className="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  );

  // Activos already linked in any subdivision (to filter from selector)
  const linkedActivoIds = new Set(Object.values(subActivos).flat().map(a => a.id));

  return (
    <div className="space-y-4">
      {/* Operador Matriz */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Operador Matriz
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAddMatriz(true)}>
            <UserPlus className="mr-1 h-3 w-3" /> Añadir contacto
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {contactosMatriz.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin contactos en la matriz.</p>}
          {contactosMatriz.map(c => <ContactRow key={c.id} c={c} />)}
        </CardContent>
      </Card>

      {/* Direcciones */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Direcciones
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowNewDir(true)}>
            <Plus className="mr-1 h-3 w-3" /> Nueva dirección
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {subdivisions.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin direcciones creadas.</p>}
          {subdivisions.map((sub: any) => {
            const contacts = subContacts[sub.id] || [];
            const activos = subActivos[sub.id] || [];
            return (
              <Collapsible key={sub.id} open={openSubs[sub.id]} onOpenChange={(o) => setOpenSubs(prev => ({ ...prev, [sub.id]: o }))}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
                    <span className="flex items-center gap-2">
                      {openSubs[sub.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {sub.nombre}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{contacts.length} contactos</Badge>
                      <Badge variant="outline">{activos.length} activos</Badge>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-6 pt-2 space-y-3">
                  {sub.descripcion && <p className="text-xs text-muted-foreground">{sub.descripcion}</p>}

                  {/* Activos vinculados */}
                  {activos.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activos</p>
                      {activos.map((a: any) => <ActivoRow key={a.id} a={a} />)}
                    </div>
                  )}

                  {/* Contactos */}
                  {contacts.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contactos</p>
                      {contacts.map((c: any) => <ContactRow key={c.id} c={c} />)}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setActiveSubId(sub.id); setShowAddSubContact(true); }}>
                      <UserPlus className="mr-1 h-3 w-3" /> Añadir contacto
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setActiveSubId(sub.id); setShowLinkActivo(true); }}>
                      <Link2 className="mr-1 h-3 w-3" /> Vincular activo
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setActiveSubId(sub.id); setShowCreateActivo(true); }}>
                      <Plus className="mr-1 h-3 w-3" /> Crear activo
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* --- Dialogs --- */}
      <QuickCreateContactDialog open={showAddMatriz} onOpenChange={setShowAddMatriz} operadorId={operadorId} onCreated={fetchAll} />
      <QuickCreateContactDialog open={showAddSubContact} onOpenChange={setShowAddSubContact} operadorId={operadorId} subdivisionId={activeSubId || undefined} onCreated={fetchAll} />

      {/* Nueva Dirección */}
      <Dialog open={showNewDir} onOpenChange={setShowNewDir}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nueva Dirección</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={newDirForm.nombre} onChange={(e) => setNewDirForm({ ...newDirForm, nombre: e.target.value })} placeholder="Ej: Dirección Zona Norte" />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Input value={newDirForm.descripcion} onChange={(e) => setNewDirForm({ ...newDirForm, descripcion: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDir(false)}>Cancelar</Button>
            <Button onClick={handleCreateDir} disabled={savingDir}>{savingDir ? "Creando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vincular Activo Existente */}
      <Dialog open={showLinkActivo} onOpenChange={setShowLinkActivo}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Vincular Activo Existente</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Selecciona un activo</Label>
            <Select value={linkActivoId} onValueChange={setLinkActivoId}>
              <SelectTrigger><SelectValue placeholder="Buscar activo..." /></SelectTrigger>
              <SelectContent>
                {allActivos.filter(a => !linkedActivoIds.has(a.id)).map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.nombre} — {a.ciudad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkActivo(false)}>Cancelar</Button>
            <Button onClick={handleLinkActivo} disabled={!linkActivoId}>Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crear Activo Nuevo */}
      <Dialog open={showCreateActivo} onOpenChange={setShowCreateActivo}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Crear Nuevo Activo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={newActivoForm.nombre} onChange={(e) => setNewActivoForm({ ...newActivoForm, nombre: e.target.value })} placeholder="Ej: C.C. Gran Vía" />
            </div>
            <div className="space-y-1">
              <Label>Dirección</Label>
              <Input value={newActivoForm.direccion} onChange={(e) => setNewActivoForm({ ...newActivoForm, direccion: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Ciudad</Label>
              <Input value={newActivoForm.ciudad} onChange={(e) => setNewActivoForm({ ...newActivoForm, ciudad: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateActivo(false)}>Cancelar</Button>
            <Button onClick={handleCreateActivo} disabled={savingActivo}>{savingActivo ? "Creando..." : "Crear y vincular"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
