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
  Upload, Download, File, Hammer, Copy,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queryRAG, ingestDocument, generateForgeDocument, FORGE_MODES, ForgeMode } from "@/services/ragService";
import { MatchCard } from "@/components/MatchCard";
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
  // Matches state
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastMatchResult, setLastMatchResult] = useState<{ latency_ms?: number; modelo?: string; ai_enhanced?: boolean } | null>(null);
  const [allLocales, setAllLocales] = useState<any[]>([]);
  // Match filters
  const [matchSortBy, setMatchSortBy] = useState<"score_desc" | "score_asc" | "estado">("score_desc");
  const [matchFilterEstado, setMatchFilterEstado] = useState<string>("todos");
  const [matchFilterSector, setMatchFilterSector] = useState<string>("todos");
  // RAG domain filter
  const [ragDominio, setRagDominio] = useState<string>("todos");
  // FORGE state
  const [forgeMode, setForgeMode] = useState<ForgeMode>("dossier_operador");
  const [forgeContext, setForgeContext] = useState("");
  const [forgeResult, setForgeResult] = useState<string>("");
  const [forgeLoading, setForgeLoading] = useState(false);
  const [forgeMeta, setForgeMeta] = useState<{ model: string; latency_ms: number } | null>(null);

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

  const handleAssignLocal = async (localId: string) => {
    const val = localId === "__none" ? null : localId;
    const { error } = await supabase.from("proyectos").update({ local_id: val }).eq("id", id!);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setProyecto((prev: any) => ({ ...prev, local_id: val }));
      toast({ title: val ? "Local asignado" : "Local desvinculado" });
    }
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

  const fetchMatches = async () => {
    if (!proyecto?.local_id) return;
    setMatchesLoading(true);
    const { data } = await supabase
      .from("matches")
      .select("*, operadores(nombre)")
      .eq("local_id", proyecto.local_id)
      .order("score", { ascending: false });
    setMatches(data || []);
    setMatchesLoading(false);
  };

  const handleGenerateMatches = async () => {
    if (!proyecto?.local_id) {
      toast({ title: "Error", description: "Este proyecto no tiene un local asignado.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setLastMatchResult(null);
    const { data, error } = await supabase.functions.invoke("generate-match", {
      body: { local_id: proyecto.local_id },
    });
    setGenerating(false);
    if (error) {
      toast({ title: "Error al generar matches", description: error.message, variant: "destructive" });
    } else {
      setLastMatchResult({ latency_ms: data?.latency_ms, modelo: data?.modelo, ai_enhanced: data?.ai_enhanced });
      toast({ title: `${data?.matches?.length || 0} matches generados`, description: `Modelo: ${data?.modelo || "rule-based"} · ${data?.latency_ms || 0}ms` });
      fetchMatches();
    }
  };

  useEffect(() => { fetchAll(); fetchAvailable(); fetchRagDocs(); }, [id]);
  useEffect(() => { if (proyecto?.local_id) fetchMatches(); }, [proyecto?.local_id]);

  const handleRagQuery = async () => {
    if (!ragQuestion.trim()) return;
    setRagLoading(true);
    setRagAnswer(null);
    const filters: Record<string, unknown> = { proyecto_id: id };
    if (ragDominio !== "todos") filters.dominio = ragDominio;
    const result = await queryRAG(ragQuestion, filters);
    if ("error" in result && result.error) {
      toast({ title: "Error RAG", description: (result as any).message, variant: "destructive" });
    } else {
      setRagAnswer(result as any);
    }
    setRagLoading(false);
  };

  const handleForgeGenerate = async () => {
    if (!forgeContext.trim()) return;
    setForgeLoading(true);
    setForgeResult("");
    setForgeMeta(null);
    const result = await generateForgeDocument(forgeMode, forgeContext, id);
    if (result.error) {
      toast({ title: "Error FORGE", description: result.error, variant: "destructive" });
    } else {
      setForgeResult(result.content);
      setForgeMeta({ model: result.model, latency_ms: result.latency_ms });
    }
    setForgeLoading(false);
  };

  const handleIngestDoc = async (docId: string) => {
    setRagIngesting(docId);
    const result = await ingestDocument(docId);
    if (result.success) {
      toast({ title: `Documento indexado: ${result.chunks_created} fragmentos`, description: `Dominio RAG: ${result.dominio || "general"}` });
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
              toast({ title: `"${file.name}" indexado (${res.chunks_created} fragmentos)`, description: `Dominio RAG: ${res.dominio || "general"}` });
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
          <TabsTrigger value="forge" className="gap-1">
            <Hammer className="h-3.5 w-3.5" /> FORGE
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
                <div className="pt-2 border-t mt-2">
                  <p className="text-muted-foreground text-xs mb-2">Local asignado (para Matching IA)</p>
                  <Select value={proyecto.local_id || "__none"} onValueChange={handleAssignLocal}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sin local asignado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Sin local —</SelectItem>
                      {allLocales.map((loc: any) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.nombre} — {loc.direccion}, {loc.ciudad}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
          {/* Header with generate button */}
          <Card>
            <CardContent className="py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" /> Motor de Matching IA
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {proyecto?.local_id
                    ? "Genera matches entre el local del proyecto y los operadores activos."
                    : "Asigna un local al proyecto para poder generar matches."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {lastMatchResult && (
                  <span className="text-xs text-muted-foreground">
                    {lastMatchResult.modelo} · {lastMatchResult.latency_ms}ms
                    {lastMatchResult.ai_enhanced && " · ✨ IA"}
                  </span>
                )}
                <Button
                  onClick={handleGenerateMatches}
                  disabled={generating || !proyecto?.local_id}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {generating ? "Generando…" : "Generar Matches"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          {matches.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="py-3 text-center">
                <p className="text-2xl font-bold">{matches.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent></Card>
              <Card><CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-chart-2">{matches.filter((m: any) => m.score >= 70).length}</p>
                <p className="text-xs text-muted-foreground">Score ≥ 70</p>
              </CardContent></Card>
              <Card><CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-chart-1">{matches.filter((m: any) => m.estado === "sugerido" || m.estado === "pendiente").length}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </CardContent></Card>
              <Card><CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-accent">{matches.filter((m: any) => m.estado === "contactado" || m.estado === "exito").length}</p>
                <p className="text-xs text-muted-foreground">Contactados</p>
              </CardContent></Card>
            </div>
          )}

          {/* Generating skeleton */}
          {generating && (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-l-4 border-l-muted">
                  <CardContent className="py-6 space-y-3">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Filters */}
          {!generating && matches.length > 0 && (() => {
            const sectors = [...new Set(matches.map((m: any) => (m.operadores as any)?.nombre ? (m.tags || []).find((t: string) => t.startsWith("sector_"))?.replace("sector_", "").replace(/_/g, " ") : null).filter(Boolean))];
            const filtered = matches
              .filter((m: any) => matchFilterEstado === "todos" || m.estado === matchFilterEstado)
              .filter((m: any) => {
                if (matchFilterSector === "todos") return true;
                return (m.tags || []).some((t: string) => t === `sector_${matchFilterSector.replace(/ /g, "_")}`);
              })
              .sort((a: any, b: any) => {
                if (matchSortBy === "score_desc") return b.score - a.score;
                if (matchSortBy === "score_asc") return a.score - b.score;
                return a.estado.localeCompare(b.estado);
              });

            const exportCSV = () => {
              const header = "Operador,Score,Estado,Tags,Explicación\n";
              const rows = filtered.map((m: any) => {
                const nombre = ((m.operadores as any)?.nombre || "").replace(/"/g, '""');
                const tags = (m.tags || []).join("; ").replace(/"/g, '""');
                const explicacion = (m.explicacion || "").replace(/"/g, '""');
                const estado = m.estado || "";
                return `"${nombre}",${m.score},"${estado}","${tags}","${explicacion}"`;
              }).join("\n");
              const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `matches_${proyecto?.nombre?.replace(/\s+/g, "_") || "proyecto"}_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast({ title: `CSV exportado (${filtered.length} matches)` });
            };

            const exportPDF = () => {
              const w = window.open("", "_blank");
              if (!w) { toast({ title: "Error", description: "Permite ventanas emergentes para exportar PDF.", variant: "destructive" }); return; }

              // Executive summary stats
              const allMatches = matches as any[];
              const avgScore = allMatches.length ? (allMatches.reduce((s: number, m: any) => s + Number(m.score), 0) / allMatches.length).toFixed(1) : "0";
              const estadoDist: Record<string, number> = {};
              allMatches.forEach((m: any) => { estadoDist[m.estado] = (estadoDist[m.estado] || 0) + 1; });
              const estadoLabelsMap: Record<string, string> = { pendiente: "Pendiente", sugerido: "Sugerido", aprobado: "Aprobado", contactado: "Contactado", descartado: "Descartado", exito: "Éxito" };
              const distHtml = Object.entries(estadoDist).map(([k, v]) => `<span style="display:inline-block;margin-right:14px"><strong>${estadoLabelsMap[k] || k}:</strong> ${v}</span>`).join("");
              const localName = allLocales.find((l: any) => l.id === proyecto?.local_id)?.nombre || proyecto?.local_id || "Sin asignar";

              const tableRows = filtered.map((m: any) =>
                `<tr><td>${(m.operadores as any)?.nombre || "-"}</td><td style="text-align:center;font-weight:bold">${m.score}%</td><td>${m.estado}</td><td style="font-size:11px">${(m.tags || []).join(", ")}</td><td style="font-size:11px">${m.explicacion || "-"}</td></tr>`
              ).join("");
              w.document.write(`<!DOCTYPE html><html><head><title>Matches - ${proyecto?.nombre || ""}</title>
                <style>body{font-family:system-ui,sans-serif;padding:24px;color:#1a1a1a}h1{font-size:18px;margin-bottom:4px}
                table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:13px}
                th{background:#f5f5f5;font-weight:600}.meta{color:#666;font-size:13px;margin-bottom:8px}
                .summary{background:#f8f9fa;border:1px solid #e2e2e2;border-radius:6px;padding:14px 18px;margin:12px 0 18px}
                .summary h2{font-size:14px;margin:0 0 8px;color:#333}.summary .kpi{font-size:22px;font-weight:700;color:#1a1a1a}
                .summary .label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px}
                .kpi-grid{display:flex;gap:28px;margin-bottom:10px}</style></head>
                <body><h1>Matches IA — ${proyecto?.nombre || ""}</h1>
                <p class="meta">Exportado: ${new Date().toLocaleString("es-ES")} · ${filtered.length} de ${allMatches.length} matches (filtrados)</p>
                <div class="summary">
                  <h2>Resumen Ejecutivo</h2>
                  <div class="kpi-grid">
                    <div><div class="label">Local asignado</div><div class="kpi" style="font-size:16px">${localName}</div></div>
                    <div><div class="label">Score medio</div><div class="kpi">${avgScore}%</div></div>
                    <div><div class="label">Total matches</div><div class="kpi">${allMatches.length}</div></div>
                  </div>
                  <div style="font-size:12px;color:#555"><strong>Distribución por estado:</strong> ${distHtml}</div>
                </div>
                <table><thead><tr><th>Operador</th><th>Score</th><th>Estado</th><th>Tags</th><th>Explicación</th></tr></thead>
                <tbody>${tableRows}</tbody></table>
                <script>window.onload=()=>{window.print()}<\/script></body></html>`);
              w.document.close();
            };

            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={matchSortBy} onValueChange={(v: any) => setMatchSortBy(v)}>
                    <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score_desc">Score ↓</SelectItem>
                      <SelectItem value="score_asc">Score ↑</SelectItem>
                      <SelectItem value="estado">Estado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={matchFilterEstado} onValueChange={setMatchFilterEstado}>
                    <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los estados</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="sugerido">Sugerido</SelectItem>
                      <SelectItem value="contactado">Contactado</SelectItem>
                      <SelectItem value="aprobado">Aprobado</SelectItem>
                      <SelectItem value="descartado">Descartado</SelectItem>
                      <SelectItem value="exito">Éxito</SelectItem>
                    </SelectContent>
                  </Select>
                  {sectors.length > 1 && (
                    <Select value={matchFilterSector} onValueChange={setMatchFilterSector}>
                      <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los sectores</SelectItem>
                        {sectors.map((s: any) => (
                          <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{filtered.length} de {matches.length}</span>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportCSV}>
                      <Download className="h-3.5 w-3.5" /> CSV
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportPDF}>
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </Button>
                  </div>
                </div>
                {filtered.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filtered.map((m: any, i: number) => (
                      <MatchCard key={m.id} match={m} index={i} onUpdate={fetchMatches} />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">Ningún match coincide con los filtros seleccionados.</p>
                )}
              </>
            );
          })()}

          {/* Empty state */}
          {!generating && matches.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-muted-foreground">
                  {proyecto?.local_id
                    ? "No hay matches todavía. Pulsa \"Generar Matches\" para empezar."
                    : "Asigna un local al proyecto desde la pestaña Resumen para habilitar el matching."}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== DOCUMENTOS ===== */}
        <TabsContent value="documentos" className="space-y-4">
          {/* Upload zone */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" /> Subir documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Label className="text-sm whitespace-nowrap">Tipo:</Label>
                <Select value={docTipo} onValueChange={setDocTipo}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="dossier">Dossier</SelectItem>
                    <SelectItem value="propuesta">Propuesta</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="informe">Informe</SelectItem>
                    <SelectItem value="plano">Plano</SelectItem>
                    <SelectItem value="foto">Foto</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
                  docDragOver ? "border-accent bg-accent/5" : "border-border"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDocDragOver(true); }}
                onDragLeave={() => setDocDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDocDragOver(false); handleDocUpload(e.dataTransfer.files, docTipo); }}
                onClick={() => document.getElementById("doc-upload-input")?.click()}
              >
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {docUploading ? "Subiendo..." : "Arrastra archivos aquí o haz clic para seleccionar"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Se indexarán automáticamente en la base de conocimiento</p>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  id="doc-upload-input"
                  onChange={(e) => { handleDocUpload(e.target.files, docTipo); e.target.value = ""; }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Document list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{proyDocs.length} documento{proyDocs.length !== 1 ? "s" : ""}</CardTitle>
            </CardHeader>
            <CardContent>
              {proyDocs.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">No hay documentos aún. Sube el primero.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tamaño</TableHead>
                      <TableHead>Estado IA</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proyDocs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[200px]">{doc.nombre}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{doc.tipo_documento || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {doc.tamano_bytes ? `${(doc.tamano_bytes / 1024).toFixed(0)} KB` : "—"}
                        </TableCell>
                        <TableCell>
                          {doc.procesado_ia ? (
                            <Badge variant="secondary" className="text-[10px] h-5">Indexado ✓</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-5">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString("es-ES") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleDocDownload(doc.storage_path)} title="Descargar">
                              <Download className="h-4 w-4" />
                            </Button>
                            {!doc.procesado_ia && (
                              <Button variant="ghost" size="icon" onClick={() => handleIngestDoc(doc.id)} disabled={ragIngesting === doc.id} title="Indexar">
                                {ragIngesting === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleDocDelete(doc.id, doc.storage_path)} className="text-muted-foreground hover:text-destructive" title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
                <div className="flex gap-2 items-end">
                  <Select value={ragDominio} onValueChange={setRagDominio}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los dominios</SelectItem>
                      <SelectItem value="contratos">📄 Contratos</SelectItem>
                      <SelectItem value="operadores">🏪 Operadores</SelectItem>
                      <SelectItem value="activos">🏢 Activos</SelectItem>
                      <SelectItem value="mercado">📈 Mercado</SelectItem>
                      <SelectItem value="personas">👤 Personas</SelectItem>
                      <SelectItem value="general">📁 General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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

        {/* ===== FORGE — Fábrica de Documentos ===== */}
        <TabsContent value="forge" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Hammer className="h-4 w-4" /> FORGE — Fábrica de Documentos IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {FORGE_MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setForgeMode(m.value)}
                    className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${forgeMode === m.value ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <span className="text-lg">{m.icon}</span>
                    <p className="font-medium text-sm mt-1">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Contexto / Instrucciones</Label>
                <Textarea
                  placeholder={
                    forgeMode === "dossier_operador"
                      ? "Nombre del operador, sector, datos relevantes..."
                      : forgeMode === "email_comunicacion"
                      ? "Destinatario, motivo del email, tono deseado..."
                      : "Describe qué necesitas generar con el mayor contexto posible..."
                  }
                  value={forgeContext}
                  onChange={(e) => setForgeContext(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleForgeGenerate}
                  disabled={forgeLoading || !forgeContext.trim()}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {forgeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hammer className="h-4 w-4 mr-2" />}
                  Generar documento
                </Button>
                {forgeMeta && (
                  <span className="text-xs text-muted-foreground">
                    Modelo: {forgeMeta.model} · {forgeMeta.latency_ms}ms
                  </span>
                )}
              </div>

              {forgeResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Resultado</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(forgeResult);
                        toast({ title: "Copiado al portapapeles" });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                    </Button>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4 max-h-[500px] overflow-y-auto">
                    <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap">{forgeResult}</div>
                  </div>
                </div>
              )}

              {!forgeResult && !forgeLoading && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Selecciona un tipo de documento, proporciona contexto y genera. FORGE enriquecerá automáticamente con datos del proyecto.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
