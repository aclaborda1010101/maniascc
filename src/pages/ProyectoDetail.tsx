import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, MapPin, Users, FileText, Sparkles, MessageSquare,
  Calendar, Plus, Trash2, UserCircle, Building2, Target, Layers,
  FileSearch, Compass, BookOpen, Send, Loader2, RefreshCw,
  Upload, Download, File,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queryRAG, ingestDocument } from "@/services/ragService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  const [loading, setLoading] = useState(true);
  const [addOpDialog, setAddOpDialog] = useState(false);
  const [addCtDialog, setAddCtDialog] = useState(false);
  const [addActivoDialog, setAddActivoDialog] = useState(false);
  const [submittingActivo, setSubmittingActivo] = useState(false);
  // RAG state
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragAnswer, setRagAnswer] = useState<{ answer: string; citations: string[]; confidence: number } | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [ragIngesting, setRagIngesting] = useState<string | null>(null);
  // Documentos state
  const [docUploading, setDocUploading] = useState(false);
  const [docDragOver, setDocDragOver] = useState(false);
  const [docTipo, setDocTipo] = useState("contrato");
  const [proyDocs, setProyDocs] = useState<any[]>([]);

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
    const [opRes, ctRes] = await Promise.all([
      supabase.from("operadores").select("id, nombre, sector").eq("activo", true).order("nombre"),
      supabase.from("contactos").select("id, nombre, apellidos, empresa").order("nombre"),
    ]);
    setAllOperadores(opRes.data || []);
    setAllContactos(ctRes.data || []);
  };

  const fetchRagDocs = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("documentos_proyecto")
      .select("id, nombre, procesado_ia, created_at, mime_type, tipo_documento, tamano_bytes, storage_path")
      .eq("proyecto_id", id)
      .order("created_at", { ascending: false });
    setRagDocs(data || []);
    setProyDocs(data || []);
  };

  useEffect(() => { fetchAll(); fetchAvailable(); fetchRagDocs(); }, [id]);

  const handleRagQuery = async () => {
    if (!ragQuestion.trim()) return;
    setRagLoading(true);
    setRagAnswer(null);
    const result = await queryRAG(ragQuestion, { proyecto_id: id });
    if ("error" in result && result.error) {
      toast({ title: "Error RAG", description: (result as any).message, variant: "destructive" });
    } else {
      setRagAnswer(result as any);
    }
    setRagLoading(false);
  };

  const handleIngestDoc = async (docId: string) => {
    setRagIngesting(docId);
    const result = await ingestDocument(docId);
    if (result.success) {
      toast({ title: `Documento indexado: ${result.chunks_created} fragmentos creados` });
      fetchRagDocs();
    } else {
      toast({ title: "Error al indexar", description: result.error, variant: "destructive" });
    }
    setRagIngesting(null);
  };

  const updateEstado = async (estado: string) => {
    await supabase.from("proyectos").update({ estado: estado as any }).eq("id", id!);
    setProyecto((p: any) => ({ ...p, estado }));
    toast({ title: `Estado actualizado a ${estadoLabels[estado]}` });
  };

  // Document upload handler
  const handleDocUpload = async (fileList: FileList | null, tipo: string) => {
    if (!fileList || fileList.length === 0 || !id || !user) return;
    setDocUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const storagePath = `proyectos/${id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("documentos_contratos")
          .upload(storagePath, file);
        if (uploadErr) throw uploadErr;

        const { data: docRow, error: insertErr } = await supabase
          .from("documentos_proyecto")
          .insert({
            proyecto_id: id,
            nombre: file.name,
            storage_path: storagePath,
            mime_type: file.type,
            tamano_bytes: file.size,
            tipo_documento: tipo,
            subido_por: user.id,
          })
          .select("id")
          .single();
        if (insertErr) throw insertErr;

        // Auto-ingest to RAG
        if (docRow) {
          ingestDocument(docRow.id).then((res) => {
            if (res.success) {
              toast({ title: `"${file.name}" indexado (${res.chunks_created} fragmentos)` });
              fetchRagDocs();
            }
          });
        }
      }
      toast({ title: `${fileList.length} archivo(s) subido(s)` });
      fetchRagDocs();
    } catch (e: any) {
      toast({ title: "Error al subir", description: e.message, variant: "destructive" });
    }
    setDocUploading(false);
  };

  const handleDocDownload = async (storagePath: string) => {
    const { data } = await supabase.storage.from("documentos_contratos").createSignedUrl(storagePath, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDocDelete = async (docId: string, storagePath: string) => {
    await supabase.storage.from("documentos_contratos").remove([storagePath]);
    await supabase.from("documentos_proyecto").delete().eq("id", docId);
    toast({ title: "Documento eliminado" });
    fetchRagDocs();
  };

  const addOperador = async (opId: string) => {
    const { error } = await supabase.from("proyecto_operadores").insert({ proyecto_id: id!, operador_id: opId });
    if (!error) { setAddOpDialog(false); fetchAll(); }
    else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const removeOperador = async (rowId: string) => {
    await supabase.from("proyecto_operadores").delete().eq("id", rowId);
    fetchAll();
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

  const handleCreateActivo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingActivo(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("activos").insert({
      proyecto_id: id!,
      nombre: fd.get("nombre") as string,
      tipo_activo: (fd.get("tipo_activo") as string) || null,
      direccion: (fd.get("direccion") as string) || null,
      codigo_postal: (fd.get("codigo_postal") as string) || null,
      metros_cuadrados: fd.get("metros_cuadrados") ? Number(fd.get("metros_cuadrados")) : null,
      renta_esperada: fd.get("renta_esperada") ? Number(fd.get("renta_esperada")) : null,
      creado_por: user?.id,
    });
    setSubmittingActivo(false);
    if (!error) { setAddActivoDialog(false); fetchAll(); toast({ title: "Activo añadido" }); }
    else toast({ title: "Error", description: error.message, variant: "destructive" });
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
            <Button variant="ghost" size="icon" onClick={() => navigate("/proyectos")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{proyecto.nombre}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">{tipoLabels[proyecto.tipo]}</Badge>
                <Badge variant="secondary" className={`text-xs ${estadoColors[proyecto.estado]}`}>
                  {estadoLabels[proyecto.estado]}
                </Badge>
                {proyecto.ubicacion && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {proyecto.ubicacion}
                  </span>
                )}
                {proyecto.fecha_objetivo && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Objetivo: {new Date(proyecto.fecha_objetivo).toLocaleDateString("es-ES")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Select value={proyecto.estado} onValueChange={updateEstado}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(estadoLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {proyecto.descripcion && <p className="text-sm text-muted-foreground max-w-2xl">{proyecto.descripcion}</p>}

      {/* Tabs — matching spec */}
      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="activos" className="gap-1">
            <Building2 className="h-3.5 w-3.5" /> Activos
            {activos.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activos.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="operadores" className="gap-1">
            <Users className="h-3.5 w-3.5" /> Operadores
            {operadores.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{operadores.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="matches" className="gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Matches IA
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1">
            <FileText className="h-3.5 w-3.5" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="validacion" className="gap-1">
            <FileSearch className="h-3.5 w-3.5" /> Validación
          </TabsTrigger>
          <TabsTrigger value="tenant-mix" className="gap-1">
            <Layers className="h-3.5 w-3.5" /> Tenant Mix
          </TabsTrigger>
          <TabsTrigger value="negociacion" className="gap-1">
            <MessageSquare className="h-3.5 w-3.5" /> Negociación
          </TabsTrigger>
          <TabsTrigger value="patrones" className="gap-1">
            <Compass className="h-3.5 w-3.5" /> Patrones
          </TabsTrigger>
          <TabsTrigger value="conocimiento" className="gap-1">
            <BookOpen className="h-3.5 w-3.5" /> Base Conocimiento
          </TabsTrigger>
        </TabsList>

        {/* ===== RESUMEN ===== */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-3"><CardTitle className="text-base">Información del proyecto</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{tipoLabels[proyecto.tipo]}</span></div>
                  <div><span className="text-muted-foreground">Creado:</span> {new Date(proyecto.created_at).toLocaleDateString("es-ES")}</div>
                  {proyecto.ubicacion && <div><span className="text-muted-foreground">Ubicación:</span> {proyecto.ubicacion}</div>}
                  {proyecto.codigo_postal && <div><span className="text-muted-foreground">CP:</span> {proyecto.codigo_postal}</div>}
                  {proyecto.presupuesto_estimado && <div><span className="text-muted-foreground">Presupuesto:</span> {Number(proyecto.presupuesto_estimado).toLocaleString("es-ES")} €</div>}
                  {proyecto.fecha_inicio && <div><span className="text-muted-foreground">Inicio:</span> {new Date(proyecto.fecha_inicio).toLocaleDateString("es-ES")}</div>}
                  {proyecto.fecha_objetivo && <div><span className="text-muted-foreground">Objetivo:</span> {new Date(proyecto.fecha_objetivo).toLocaleDateString("es-ES")}</div>}
                </div>
                {proyecto.notas && <div className="pt-2 border-t mt-2"><p className="text-muted-foreground text-xs mb-1">Notas</p><p>{proyecto.notas}</p></div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">KPIs del Proyecto</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Activos</span><span className="font-medium">{activos.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Operadores</span><span className="font-medium">{operadores.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Contactos</span><span className="font-medium">{contactosVinculados.length}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== ACTIVOS ===== */}
        <TabsContent value="activos" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{activos.length} activo{activos.length !== 1 ? "s" : ""}</p>
            <Dialog open={addActivoDialog} onOpenChange={setAddActivoDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-1 h-3.5 w-3.5" /> Añadir Activo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Añadir Activo al Proyecto</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateActivo} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre *</Label>
                    <Input name="nombre" placeholder="Local 12-A Planta Baja" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select name="tipo_activo" defaultValue="local_comercial">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local_comercial">Local Comercial</SelectItem>
                          <SelectItem value="centro_comercial">Centro Comercial</SelectItem>
                          <SelectItem value="parque_medianas">Parque Medianas</SelectItem>
                          <SelectItem value="high_street">High Street</SelectItem>
                          <SelectItem value="nave">Nave</SelectItem>
                          <SelectItem value="suelo">Suelo</SelectItem>
                          <SelectItem value="edificio_retail">Edificio Retail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>m²</Label>
                      <Input name="metros_cuadrados" type="number" placeholder="150" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dirección</Label>
                      <Input name="direccion" placeholder="Av. Principal 12" />
                    </div>
                    <div className="space-y-2">
                      <Label>Renta esperada (€/mes)</Label>
                      <Input name="renta_esperada" type="number" placeholder="3000" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submittingActivo}>
                    {submittingActivo ? "Añadiendo..." : "Añadir Activo"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {activos.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">No hay activos en este proyecto. Añade el primero.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activos.map((a) => (
                <Card key={a.id}>
                  <CardContent className="pt-6 space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold">{a.nombre}</h4>
                      <Badge variant="outline" className="text-xs">{a.estado}</Badge>
                    </div>
                    {a.tipo_activo && <Badge variant="secondary" className="text-xs">{a.tipo_activo.replace(/_/g, " ")}</Badge>}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {a.metros_cuadrados && <span>{Number(a.metros_cuadrados).toLocaleString("es-ES")} m²</span>}
                      {a.renta_esperada && <span>{Number(a.renta_esperada).toLocaleString("es-ES")} €/mes</span>}
                    </div>
                    {a.direccion && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{a.direccion}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== OPERADORES ===== */}
        <TabsContent value="operadores" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{operadores.length} operador{operadores.length !== 1 ? "es" : ""}</p>
            <Dialog open={addOpDialog} onOpenChange={setAddOpDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" /> Vincular Operador</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Vincular Operador</DialogTitle></DialogHeader>
                {availableOps.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No hay operadores disponibles.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableOps.map((op) => (
                      <button key={op.id} onClick={() => addOperador(op.id)}
                        className="w-full flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors text-left">
                        <div><p className="font-medium text-sm">{op.nombre}</p><p className="text-xs text-muted-foreground">{op.sector}</p></div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
          {operadores.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">No hay operadores vinculados.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {operadores.map((row) => {
                const op = row.operadores as any;
                return (
                  <div key={row.id} className="flex items-center justify-between rounded-md border p-3">
                    <Link to={`/operadores/${op?.id}`} className="flex-1 min-w-0">
                      <p className="font-medium text-accent hover:underline">{op?.nombre}</p>
                      <p className="text-xs text-muted-foreground">{op?.sector} · {row.rol}</p>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => removeOperador(row.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== MATCHES IA ===== */}
        <TabsContent value="matches" className="space-y-4">
          <Card><CardContent className="py-12 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground mb-3">Genera matches IA entre los activos y operadores del proyecto.</p>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={activos.length === 0 || operadores.length === 0}>
              <Sparkles className="mr-2 h-4 w-4" /> Generar Matches
            </Button>
            {(activos.length === 0 || operadores.length === 0) && (
              <p className="text-xs text-muted-foreground mt-2">Necesitas al menos 1 activo y 1 operador.</p>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* ===== DOCUMENTOS ===== */}
        <TabsContent value="documentos" className="space-y-4">
          <Card><CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">Sube documentos asociados a este proyecto: contratos, dossiers, propuestas, emails.</p>
            <Button className="mt-3" variant="outline"><Plus className="mr-2 h-4 w-4" /> Subir Documento</Button>
          </CardContent></Card>
        </TabsContent>

        {/* ===== VALIDACIÓN ===== */}
        <TabsContent value="validacion" className="space-y-4">
          <Card><CardContent className="py-12 text-center">
            <FileSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">Valida dossiers de propietarios con IA. Compara métricas declaradas vs benchmarks de zona.</p>
            <Button className="mt-3 bg-accent text-accent-foreground hover:bg-accent/90"><FileSearch className="mr-2 h-4 w-4" /> Subir Dossier para Validar</Button>
          </CardContent></Card>
        </TabsContent>

        {/* ===== TENANT MIX ===== */}
        <TabsContent value="tenant-mix" className="space-y-4">
          <Card><CardContent className="py-12 text-center">
            <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">Genera configuraciones óptimas de tenant mix (planes A/B/C) para este proyecto.</p>
            <Button className="mt-3 bg-accent text-accent-foreground hover:bg-accent/90" disabled={operadores.length < 2}>
              <Sparkles className="mr-2 h-4 w-4" /> Generar Configuración Óptima
            </Button>
          </CardContent></Card>
        </TabsContent>

        {/* ===== NEGOCIACIÓN ===== */}
        <TabsContent value="negociacion" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Deals y negociaciones activas del proyecto</p>
            <Dialog open={addCtDialog} onOpenChange={setAddCtDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" /> Vincular Contacto</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Vincular Contacto</DialogTitle></DialogHeader>
                {availableCts.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">No hay contactos disponibles.</p>
                    <Button asChild size="sm" variant="outline"><Link to="/contactos">Crear contacto</Link></Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableCts.map((ct) => (
                      <button key={ct.id} onClick={() => addContacto(ct.id)}
                        className="w-full flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors text-left">
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
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{ct?.nombre} {ct?.apellidos || ""}</p>
                      <p className="text-xs text-muted-foreground">{ct?.cargo && `${ct.cargo} · `}{ct?.empresa || ""}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeContacto(row.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

        {/* ===== PATRONES ===== */}
        <TabsContent value="patrones" className="space-y-4">
          <Card><CardContent className="py-12 text-center">
            <Compass className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">Analiza patrones de localización, señales débiles y benchmarks de zona.</p>
            <Button className="mt-3 bg-accent text-accent-foreground hover:bg-accent/90"><Compass className="mr-2 h-4 w-4" /> Analizar Localización</Button>
          </CardContent></Card>
        </TabsContent>

        {/* ===== BASE DE CONOCIMIENTO (RAG) ===== */}
        <TabsContent value="conocimiento" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Q&A Panel */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Pregunta a tus documentos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="¿Cuáles son las condiciones del contrato...?"
                    value={ragQuestion}
                    onChange={(e) => setRagQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRagQuery()}
                    disabled={ragLoading}
                  />
                  <Button
                    onClick={handleRagQuery}
                    disabled={ragLoading || !ragQuestion.trim()}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {ragLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>

                {ragAnswer && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm whitespace-pre-wrap">{ragAnswer.answer}</p>
                    {ragAnswer.citations.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Fuentes:</p>
                        <div className="flex flex-wrap gap-1">
                          {ragAnswer.citations.map((c, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Confianza: {Math.round(ragAnswer.confidence * 100)}%</span>
                    </div>
                  </div>
                )}

                {!ragAnswer && !ragLoading && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Haz una pregunta sobre los documentos indexados de este proyecto.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Indexed Documents Panel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Documentos indexados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ragDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay documentos en este proyecto. Sube documentos en la pestaña Documentos.
                  </p>
                ) : (
                  ragDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.procesado_ia ? (
                            <Badge variant="secondary" className="text-[10px] h-4">Indexado ✓</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-4">Sin indexar</Badge>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleIngestDoc(doc.id)}
                        disabled={ragIngesting === doc.id}
                        title={doc.procesado_ia ? "Reindexar" : "Indexar"}
                      >
                        {ragIngesting === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
