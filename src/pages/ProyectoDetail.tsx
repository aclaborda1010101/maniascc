import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, MapPin, Users, FileText, Sparkles, MessageSquare,
  Calendar, Building2, Target, Layers, FileSearch, Compass,
  BookOpen, Hammer, Plus, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { ProyectoResumen } from "@/components/proyecto/ProyectoResumen";
import { ProyectoActivos } from "@/components/proyecto/ProyectoActivos";
import { ProyectoOperadores } from "@/components/proyecto/ProyectoOperadores";
import { ProyectoMatches } from "@/components/proyecto/ProyectoMatches";
import { ProyectoDocumentos } from "@/components/proyecto/ProyectoDocumentos";
import { ProyectoRAG } from "@/components/proyecto/ProyectoRAG";
import { ProyectoForge } from "@/components/proyecto/ProyectoForge";

const estadoLabels: Record<string, string> = {
  borrador: "Borrador", activo: "Activo", en_pausa: "En pausa",
  en_negociacion: "En negociación",
  cerrado_exito: "Cerrado ✓", cerrado_sin_exito: "Cerrado ✗",
  archivado: "Archivado",
};
const estadoColors: Record<string, string> = {
  borrador: "bg-muted text-muted-foreground", activo: "bg-chart-2/10 text-chart-2",
  en_pausa: "bg-chart-3/10 text-chart-3", en_negociacion: "bg-chart-3/10 text-chart-3",
  cerrado_exito: "bg-accent/10 text-accent", cerrado_sin_exito: "bg-destructive/10 text-destructive",
  archivado: "bg-muted text-muted-foreground",
};
const tipoLabels: Record<string, string> = {
  comercializacion: "Comercialización", negociacion: "Negociación",
  centro_completo: "Centro Completo", auditoria_estrategica: "Auditoría Estratégica",
  desarrollo_suelo: "Desarrollo Suelo", traspaso_adquisicion: "Traspaso/Adquisición",
  farmacia: "Farmacia", otro: "Otro",
};

export default function ProyectoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [proyecto, setProyecto] = useState<any>(null);
  const [activos, setActivos] = useState<any[]>([]);
  const [operadores, setOperadores] = useState<any[]>([]);
  const [contactosVinculados, setContactosVinculados] = useState<any[]>([]);
  const [allOperadores, setAllOperadores] = useState<any[]>([]);
  const [allContactos, setAllContactos] = useState<any[]>([]);
  const [allLocales, setAllLocales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addCtDialog, setAddCtDialog] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);
    const [proyRes, activosRes, opsRes, ctsRes] = await Promise.all([
      supabase.from("proyectos").select("*").eq("id", id).single(),
      supabase.from("activos").select("*").eq("proyecto_id", id).order("created_at"),
      supabase.from("proyecto_operadores").select("*, operadores(id, nombre, sector, activo)").eq("proyecto_id", id),
      supabase.from("proyecto_contactos").select("*, contactos:contacto_id(id, nombre, apellidos, empresa, cargo)").eq("proyecto_id", id),
    ]);
    setProyecto(proyRes.data);
    setActivos(activosRes.data || []);
    setOperadores(opsRes.data || []);
    setContactosVinculados(ctsRes.data || []);
    setLoading(false);
  };

  const fetchAvailable = async () => {
    const [opRes, ctRes, locRes] = await Promise.all([
      supabase.from("operadores").select("id, nombre, sector").eq("activo", true).order("nombre"),
      supabase.from("contactos").select("id, nombre, apellidos, empresa").order("nombre"),
      supabase.from("locales").select("id, nombre, direccion, ciudad").order("nombre"),
    ]);
    setAllOperadores(opRes.data || []);
    setAllContactos(ctRes.data || []);
    setAllLocales(locRes.data || []);
  };

  const fetchDocs = async () => {
    if (!id) return;
    const { data } = await supabase.from("documentos_proyecto")
      .select("id, nombre, procesado_ia, created_at, mime_type, tipo_documento, tamano_bytes, storage_path")
      .eq("proyecto_id", id).order("created_at", { ascending: false });
    setDocs(data || []);
  };

  const fetchMatches = async () => {
    if (!proyecto?.local_id) return;
    const { data } = await supabase.from("matches").select("*, operadores(nombre)").eq("local_id", proyecto.local_id).order("score", { ascending: false });
    setMatches(data || []);
  };

  useEffect(() => { fetchAll(); fetchAvailable(); fetchDocs(); }, [id]);
  useEffect(() => { if (proyecto?.local_id) fetchMatches(); }, [proyecto?.local_id]);

  const handleAssignLocal = async (localId: string) => {
    const val = localId === "__none" ? null : localId;
    const { error } = await supabase.from("proyectos").update({ local_id: val }).eq("id", id!);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setProyecto((prev: any) => ({ ...prev, local_id: val })); toast({ title: val ? "Local asignado" : "Local desvinculado" }); }
  };

  const updateEstado = async (estado: string) => {
    await supabase.from("proyectos").update({ estado: estado as any }).eq("id", id!);
    setProyecto((p: any) => ({ ...p, estado }));
    toast({ title: `Estado actualizado a ${estadoLabels[estado]}` });
  };

  const addContacto = async (ctId: string) => {
    const { error } = await supabase.from("proyecto_contactos").insert({ proyecto_id: id!, contacto_id: ctId });
    if (!error) { setAddCtDialog(false); fetchAll(); }
    else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const removeContacto = async (rowId: string) => {
    await supabase.from("proyecto_contactos").delete().eq("id", rowId);
    fetchAll();
  };

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!proyecto) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate("/proyectos")}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
      <p className="text-muted-foreground">Proyecto no encontrado.</p>
    </div>
  );

  const linkedOpIds = new Set(operadores.map((o) => (o.operadores as any)?.id));
  const linkedCtIds = new Set(contactosVinculados.map((c) => c.contacto_id));
  const availableOps = allOperadores.filter((o) => !linkedOpIds.has(o.id));
  const availableCts = allContactos.filter((c) => !linkedCtIds.has(c.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/proyectos")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{proyecto.nombre}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">{tipoLabels[proyecto.tipo]}</Badge>
                <Badge variant="secondary" className={`text-xs ${estadoColors[proyecto.estado]}`}>{estadoLabels[proyecto.estado]}</Badge>
                {proyecto.ubicacion && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {proyecto.ubicacion}</span>}
                {proyecto.fecha_objetivo && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" /> Objetivo: {new Date(proyecto.fecha_objetivo).toLocaleDateString("es-ES")}</span>}
              </div>
            </div>
          </div>
        </div>
        <Select value={proyecto.estado} onValueChange={updateEstado}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(estadoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {proyecto.descripcion && <p className="text-sm text-muted-foreground max-w-2xl">{proyecto.descripcion}</p>}

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="activos" className="gap-1"><Building2 className="h-3.5 w-3.5" /> Activos{activos.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activos.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="operadores" className="gap-1"><Users className="h-3.5 w-3.5" /> Operadores{operadores.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{operadores.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="matches" className="gap-1"><Sparkles className="h-3.5 w-3.5" /> Matches IA</TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1"><FileText className="h-3.5 w-3.5" /> Documentos</TabsTrigger>
          <TabsTrigger value="conocimiento" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> Conocimiento</TabsTrigger>
          <TabsTrigger value="forge" className="gap-1"><Hammer className="h-3.5 w-3.5" /> FORGE</TabsTrigger>
          <TabsTrigger value="negociacion" className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Negociación</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <ProyectoResumen proyecto={proyecto} activos={activos} operadores={operadores} contactos={contactosVinculados} allLocales={allLocales} onAssignLocal={handleAssignLocal} />
        </TabsContent>

        <TabsContent value="activos">
          <ProyectoActivos proyectoId={id!} activos={activos} onRefresh={fetchAll} />
        </TabsContent>

        <TabsContent value="operadores">
          <ProyectoOperadores proyectoId={id!} operadores={operadores} availableOps={availableOps} onRefresh={fetchAll} />
        </TabsContent>

        <TabsContent value="matches">
          <ProyectoMatches proyecto={proyecto} matches={matches} allLocales={allLocales} onRefreshMatches={fetchMatches} />
        </TabsContent>

        <TabsContent value="documentos">
          <ProyectoDocumentos proyectoId={id!} docs={docs} onRefresh={fetchDocs} />
        </TabsContent>

        <TabsContent value="conocimiento">
          <ProyectoRAG proyectoId={id!} docs={docs} onRefreshDocs={fetchDocs} />
        </TabsContent>

        <TabsContent value="forge">
          <ProyectoForge proyectoId={id!} />
        </TabsContent>

        <TabsContent value="negociacion" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Deals y negociaciones activas del proyecto</p>
            <Dialog open={addCtDialog} onOpenChange={setAddCtDialog}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" /> Vincular Contacto</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Vincular Contacto</DialogTitle></DialogHeader>
                {availableCts.length === 0 ? (
                  <div className="py-4 text-center"><p className="text-sm text-muted-foreground mb-2">No hay contactos disponibles.</p><Button asChild size="sm" variant="outline"><Link to="/contactos">Crear contacto</Link></Button></div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableCts.map((ct) => (
                      <button key={ct.id} onClick={() => addContacto(ct.id)} className="w-full flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors text-left">
                        <div><p className="font-medium text-sm">{ct.nombre} {ct.apellidos || ""}</p><p className="text-xs text-muted-foreground">{ct.empresa || ""}</p></div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
          {contactosVinculados.length > 0 && (
            <div className="space-y-2">
              {contactosVinculados.map((row) => {
                const ct = row.contactos as any;
                return (
                  <div key={row.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex-1 min-w-0"><p className="font-medium">{ct?.nombre} {ct?.apellidos || ""}</p><p className="text-xs text-muted-foreground">{ct?.cargo && `${ct.cargo} · `}{ct?.empresa || ""}</p></div>
                    <Button variant="ghost" size="icon" onClick={() => removeContacto(row.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                );
              })}
            </div>
          )}
          <Card><CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">Crea deals de negociación vinculando operadores, activos e interlocutores.</p>
            <Button className="mt-3" variant="outline"><Plus className="mr-2 h-4 w-4" /> Nuevo Deal</Button>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
