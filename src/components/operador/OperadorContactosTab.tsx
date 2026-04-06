import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { QuickCreateContactDialog } from "@/components/QuickCreateContactDialog";
import { UserPlus, Plus, ChevronDown, ChevronRight, Building2, Mail, Phone, Users } from "lucide-react";
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
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});
  const [showAddMatriz, setShowAddMatriz] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [showNewSubDiv, setShowNewSubDiv] = useState(false);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [newSubForm, setNewSubForm] = useState({ nombre: "", descripcion: "" });
  const [savingSub, setSavingSub] = useState(false);

  const fetchAll = async () => {
    const [cRes, sRes] = await Promise.all([
      supabase.from("contactos").select("*").eq("operador_id", operadorId).is("subdivision_id", null),
      supabase.from("operador_subdivisiones" as any).select("*").eq("operador_id", operadorId).order("created_at"),
    ]);
    setContactosMatriz(cRes.data || []);
    const subs = (sRes.data || []) as any[];
    setSubdivisions(subs);

    if (subs.length > 0) {
      const subIds = subs.map((s: any) => s.id);
      const { data: sc } = await supabase.from("contactos").select("*").in("subdivision_id", subIds);
      const grouped: Record<string, any[]> = {};
      (sc || []).forEach((c: any) => {
        if (!grouped[c.subdivision_id]) grouped[c.subdivision_id] = [];
        grouped[c.subdivision_id].push(c);
      });
      setSubContacts(grouped);
    }
  };

  useEffect(() => { fetchAll(); }, [operadorId]);

  const handleCreateSubDiv = async () => {
    if (!newSubForm.nombre.trim()) return;
    setSavingSub(true);
    const { error } = await supabase.from("operador_subdivisiones" as any).insert({
      operador_id: operadorId,
      nombre: newSubForm.nombre,
      descripcion: newSubForm.descripcion || null,
    } as any);
    setSavingSub(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Subdivisión creada" });
      setNewSubForm({ nombre: "", descripcion: "" });
      setShowNewSubDiv(false);
      fetchAll();
    }
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

  return (
    <div className="space-y-4">
      {/* Contactos Matriz */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Contactos Matriz
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAddMatriz(true)}>
            <UserPlus className="mr-1 h-3 w-3" /> Añadir
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {contactosMatriz.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin contactos en la matriz.</p>}
          {contactosMatriz.map(c => <ContactRow key={c.id} c={c} />)}
        </CardContent>
      </Card>

      {/* Subdivisiones */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Subdivisiones
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowNewSubDiv(true)}>
            <Plus className="mr-1 h-3 w-3" /> Nueva subdivisión
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {subdivisions.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin subdivisiones creadas.</p>}
          {subdivisions.map((sub: any) => (
            <Collapsible key={sub.id} open={openSubs[sub.id]} onOpenChange={(o) => setOpenSubs(prev => ({ ...prev, [sub.id]: o }))}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
                  <span className="flex items-center gap-2">
                    {openSubs[sub.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {sub.nombre}
                  </span>
                  <Badge variant="secondary">{(subContacts[sub.id] || []).length} contactos</Badge>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6 pt-2 space-y-2">
                {sub.descripcion && <p className="text-xs text-muted-foreground mb-2">{sub.descripcion}</p>}
                {(subContacts[sub.id] || []).map((c: any) => <ContactRow key={c.id} c={c} />)}
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setActiveSubId(sub.id); setShowAddSub(true); }}>
                  <UserPlus className="mr-1 h-3 w-3" /> Añadir contacto
                </Button>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <QuickCreateContactDialog open={showAddMatriz} onOpenChange={setShowAddMatriz} operadorId={operadorId} onCreated={fetchAll} />
      <QuickCreateContactDialog open={showAddSub} onOpenChange={setShowAddSub} operadorId={operadorId} subdivisionId={activeSubId || undefined} onCreated={fetchAll} />

      <Dialog open={showNewSubDiv} onOpenChange={setShowNewSubDiv}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nueva Subdivisión</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={newSubForm.nombre} onChange={(e) => setNewSubForm({ ...newSubForm, nombre: e.target.value })} placeholder="Ej: Dirección Zona Norte" />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Input value={newSubForm.descripcion} onChange={(e) => setNewSubForm({ ...newSubForm, descripcion: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSubDiv(false)}>Cancelar</Button>
            <Button onClick={handleCreateSubDiv} disabled={savingSub}>{savingSub ? "Creando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
