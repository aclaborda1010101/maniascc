import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { EntityNarrativesPanel } from "@/components/EntityNarrativesPanel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Trash2, Sparkles, CheckCircle, Plus, Building2, UserPlus, Mail, Phone, FileText, ChevronDown, ChevronRight, LayoutDashboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { UploadZone } from "@/components/UploadZone";
import { QuickCreateContactDialog } from "@/components/QuickCreateContactDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { OperadorInfoCard } from "@/components/operador/OperadorInfoCard";
import { ContactosAsociadosTable } from "@/components/operador/ContactosAsociadosTable";
import { SubdivisionesGrid } from "@/components/operador/SubdivisionesGrid";
import { DocumentosLinkeadosList } from "@/components/operador/DocumentosLinkeadosList";
import { ProyectosCard } from "@/components/operador/ProyectosCard";

const SECTORES = [
  "Alimentación", "Moda", "Restauración", "Hogar", "Electrónica",
  "Deportes", "Salud", "Servicios", "Ocio", "Financiero", "Otro",
];

export default function OperadorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [op, setOp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subOps, setSubOps] = useState<any[]>([]);
  const [subContacts, setSubContacts] = useState<Record<string, any[]>>({});
  const [subDocs, setSubDocs] = useState<Record<string, any[]>>({});
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [submittingSub, setSubmittingSub] = useState(false);
  const [showAddContact, setShowAddContact] = useState<string | null>(null);
  const [activos, setActivos] = useState<any[]>([]);
  const [tab, setTab] = useState("vista");

  useEffect(() => {
    supabase.from("operadores").select("*").eq("id", id).single().then(({ data }) => {
      setOp(data);
      setLoading(false);
    });
    fetchSubOps();
    supabase.from("locales").select("id, nombre, direccion").order("nombre").then(({ data }) => setActivos(data || []));
  }, [id]);

  const fetchSubOps = async () => {
    const { data } = await supabase.from("operadores").select("*").eq("matriz_id", id).order("nombre");
    const subs = data || [];
    setSubOps(subs);
    // Fetch contacts and docs for each sub
    const contactMap: Record<string, any[]> = {};
    const docMap: Record<string, any[]> = {};
    await Promise.all(subs.map(async (s: any) => {
      const [cRes, dRes] = await Promise.all([
        supabase.from("contactos").select("*").eq("operador_id", s.id),
        supabase.storage.from("documentos_contratos").list(`operadores/${s.id}`, { limit: 100 }),
      ]);
      contactMap[s.id] = cRes.data || [];
      docMap[s.id] = (dRes.data || []).filter((f: any) => f.name !== ".emptyFolderPlaceholder");
    }));
    setSubContacts(contactMap);
    setSubDocs(docMap);
  };

  const handleSave = async () => {
    if (!op) return;
    setSaving(true);
    const { error } = await supabase.from("operadores").update({
      nombre: op.nombre, sector: op.sector, direccion: op.direccion,
      presupuesto_min: op.presupuesto_min, presupuesto_max: op.presupuesto_max,
      superficie_min: op.superficie_min, superficie_max: op.superficie_max,
      descripcion: op.descripcion, activo: op.activo,
    } as any).eq("id", id);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Operador actualizado correctamente" });
  };

  const handleDelete = async () => {
    await supabase.from("operadores").delete().eq("id", id);
    toast({ title: "Operador eliminado" });
    navigate("/operadores");
  };

  const handleCreateSub = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingSub(true);
    const fd = new FormData(e.currentTarget);
    const activoId = fd.get("activo_id") as string;
    const { error } = await supabase.from("operadores").insert({
      nombre: fd.get("nombre") as string,
      sector: op.sector,
      direccion: (fd.get("direccion") as string) || null,
      presupuesto_min: Number(fd.get("presupuesto_min")) || 0,
      presupuesto_max: Number(fd.get("presupuesto_max")) || 0,
      superficie_min: Number(fd.get("superficie_min")) || 0,
      superficie_max: Number(fd.get("superficie_max")) || 0,
      descripcion: (fd.get("descripcion") as string) || null,
      matriz_id: id,
      activo_id: activoId && activoId !== "none" ? activoId : null,
      created_by: user?.id,
    } as any);
    setSubmittingSub(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Sub-operador creado" }); setShowCreateSub(false); fetchSubOps(); }
  };

  const toggleExpanded = (subId: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      next.has(subId) ? next.delete(subId) : next.add(subId);
      return next;
    });
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!op) return <p className="text-muted-foreground">Operador no encontrado.</p>;

  const perfilIA = op.perfil_ia ? (typeof op.perfil_ia === "string" ? op.perfil_ia : JSON.stringify(op.perfil_ia, null, 2)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/operadores")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{op.nombre}</h1>
          <p className="text-sm text-muted-foreground">{op.sector}{op.direccion ? ` · ${op.direccion}` : ""}</p>
        </div>
        {!op.matriz_id && <Badge variant="outline">Matriz</Badge>}
        <Badge variant={op.perfil_ia ? "default" : "secondary"}>{op.perfil_ia ? "Perfil IA Completo" : "Perfil IA Pendiente"}</Badge>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este operador?</AlertDialogTitle>
              <AlertDialogDescription>Se eliminará "{op.nombre}" y todos sus sub-operadores asociados.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        {/* Mobile: select */}
        <div className="md:hidden mb-3">
          <Select value={tab} onValueChange={setTab}>
            <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Información General</SelectItem>
              <SelectItem value="perfil-ia">Perfil IA</SelectItem>
              <SelectItem value="suboperadores">Sub-operadores ({subOps.length})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Desktop: tabs */}
        <TabsList className="hidden md:inline-flex">
          <TabsTrigger value="info">Información General</TabsTrigger>
          <TabsTrigger value="perfil-ia">Perfil IA</TabsTrigger>
          <TabsTrigger value="suboperadores">Sub-operadores ({subOps.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader><CardTitle>Datos del Operador</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nombre identificativo</Label><Input value={op.nombre} onChange={(e) => setOp({ ...op, nombre: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Sector</Label>
                  <select value={op.sector} onChange={(e) => setOp({ ...op, sector: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Seleccionar sector</option>
                    {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
                    {op.sector && !SECTORES.includes(op.sector) && <option value={op.sector}>{op.sector}</option>}
                  </select>
                </div>
              </div>
              <div className="space-y-2"><Label>Dirección</Label><Input value={op.direccion || ""} onChange={(e) => setOp({ ...op, direccion: e.target.value })} placeholder="Calle, número, ciudad" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Presupuesto Min (€/mes)</Label><Input type="number" value={op.presupuesto_min} onChange={(e) => setOp({ ...op, presupuesto_min: Number(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Presupuesto Max (€/mes)</Label><Input type="number" value={op.presupuesto_max} onChange={(e) => setOp({ ...op, presupuesto_max: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Superficie Min (m²)</Label><Input type="number" value={op.superficie_min} onChange={(e) => setOp({ ...op, superficie_min: Number(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Superficie Max (m²)</Label><Input type="number" value={op.superficie_max} onChange={(e) => setOp({ ...op, superficie_max: Number(e.target.value) })} /></div>
              </div>
              <div className="space-y-2"><Label>Descripción</Label><Textarea value={op.descripcion || ""} onChange={(e) => setOp({ ...op, descripcion: e.target.value })} rows={3} /></div>
              <div className="flex items-center gap-3">
                <Switch checked={op.activo} onCheckedChange={(v) => setOp({ ...op, activo: v })} />
                <Label>Operador activo</Label>
              </div>
              <Button onClick={handleSave} disabled={saving} className="bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md">
                <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perfil-ia">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> Perfil IA</CardTitle></CardHeader>
            <CardContent>
              {perfilIA ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/50 p-4"><pre className="whitespace-pre-wrap text-sm">{perfilIA}</pre></div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4 text-chart-2" />Perfil generado por IA</div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground">Sube un documento comercial para generar el perfil automáticamente.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suboperadores">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{subOps.length} sub-operador{subOps.length !== 1 ? "es" : ""} vinculados a esta matriz</p>
              <Button size="sm" onClick={() => setShowCreateSub(true)} className="bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md">
                <Plus className="mr-1 h-3 w-3" /> Nuevo sub-operador
              </Button>
            </div>

            {subOps.length === 0 && (
              <Card><CardContent className="py-8 text-center">
                <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-muted-foreground">Sin sub-operadores. Crea el primero.</p>
              </CardContent></Card>
            )}

            {subOps.map((sub) => {
              const isOpen = expandedSubs.has(sub.id);
              const contacts = subContacts[sub.id] || [];
              const docs = subDocs[sub.id] || [];
              return (
                <Collapsible key={sub.id} open={isOpen} onOpenChange={() => toggleExpanded(sub.id)}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <div className="flex-1">
                            <CardTitle className="text-base">
                              <Link to={`/operadores/${sub.id}`} className="hover:underline text-accent" onClick={(e) => e.stopPropagation()}>
                                {sub.nombre}
                              </Link>
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {sub.direccion || "Sin dirección"} · {sub.sector}
                              {sub.activo_id && " · Activo vinculado"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{contacts.length} contacto{contacts.length !== 1 ? "s" : ""}</span>
                            <span>·</span>
                            <span>{docs.length} doc{docs.length !== 1 ? "s" : ""}</span>
                          </div>
                          <Badge variant={sub.activo ? "default" : "secondary"} className={sub.activo ? "bg-chart-2/10 text-chart-2" : ""}>
                            {sub.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4 border-t pt-4">
                        {/* Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div><span className="text-muted-foreground">Presupuesto:</span><br/>{Number(sub.presupuesto_min).toLocaleString("es-ES")} – {Number(sub.presupuesto_max).toLocaleString("es-ES")} €</div>
                          <div><span className="text-muted-foreground">Superficie:</span><br/>{sub.superficie_min} – {sub.superficie_max} m²</div>
                          <div><span className="text-muted-foreground">Dirección:</span><br/>{sub.direccion || "—"}</div>
                          <div><span className="text-muted-foreground">Sector:</span><br/>{sub.sector || "—"}</div>
                        </div>

                        {/* Contacts */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">Contactos</h4>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddContact(sub.id)}>
                              <UserPlus className="mr-1 h-3 w-3" /> Añadir
                            </Button>
                          </div>
                          {contacts.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin contactos</p>
                          ) : contacts.map(c => (
                            <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 mb-1">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                  {c.nombre?.[0]}{c.apellidos?.[0] || ""}
                                </div>
                                <Link to={`/contactos/${c.id}`} className="text-sm hover:underline">{c.nombre} {c.apellidos || ""}</Link>
                                {c.cargo && <span className="text-xs text-muted-foreground">· {c.cargo}</span>}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                                {c.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefono}</span>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Docs */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">Documentos</h4>
                          <UploadZone
                            bucket="documentos_contratos"
                            folder={`operadores/${sub.id}`}
                            files={docs}
                            onUploadComplete={() => fetchSubOps()}
                          />
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>

          {/* Create sub-operator dialog */}
          <Dialog open={showCreateSub} onOpenChange={setShowCreateSub}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nuevo Sub-operador de {op.nombre}</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateSub} className="space-y-4">
                <div className="space-y-2"><Label>Nombre identificativo *</Label><Input name="nombre" required placeholder="Ej: Dirección Norte" /></div>
                <div className="space-y-2"><Label>Dirección</Label><Input name="direccion" placeholder="Calle, número, ciudad" /></div>
                <div className="space-y-2">
                  <Label>Sector</Label>
                  <Input value={op.sector} disabled className="bg-muted" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Presupuesto Min (€/mes)</Label><Input name="presupuesto_min" type="number" min="0" /></div>
                  <div className="space-y-2"><Label>Presupuesto Max (€/mes)</Label><Input name="presupuesto_max" type="number" min="0" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Superficie Min (m²)</Label><Input name="superficie_min" type="number" min="0" /></div>
                  <div className="space-y-2"><Label>Superficie Max (m²)</Label><Input name="superficie_max" type="number" min="0" /></div>
                </div>
                <div className="space-y-2">
                  <Label>Activo vinculado (opcional)</Label>
                  <Select name="activo_id" defaultValue="none">
                    <SelectTrigger><SelectValue placeholder="Seleccionar activo..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguno</SelectItem>
                      {activos.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre} — {a.direccion}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Descripción</Label><Textarea name="descripcion" rows={2} /></div>
                <Button type="submit" className="w-full bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md" disabled={submittingSub}>
                  {submittingSub ? "Creando..." : "Crear Sub-operador"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Add contact to sub-operator */}
          {showAddContact && (
            <QuickCreateContactDialog
              open={!!showAddContact}
              onOpenChange={() => setShowAddContact(null)}
              operadorId={showAddContact}
              onCreated={fetchSubOps}
            />
          )}
        </TabsContent>
      </Tabs>
      {id && <EntityNarrativesPanel entityType="operador" entityId={id} className="mt-4" />}
    </div>
  );
}
