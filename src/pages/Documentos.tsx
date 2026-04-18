import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Image as ImageIcon, FolderOpen, Cloud, Search, Tags, Sparkles,
  RefreshCw, Lock, Globe2, Users as UsersIcon, AlertCircle, CheckCircle2, Loader2, Upload, Database,
} from "lucide-react";
import { toast } from "sonner";
import { UploadZone } from "@/components/UploadZone";
import {
  fetchDocumentos, fetchTaxonomias, classifyDocument,
  fetchOneDriveState, startOneDriveSync, fetchIngestionJobs,
  type DocumentoExt, type Taxonomia,
} from "@/services/documentService";

const SENSIBILIDAD_STYLES: Record<string, string> = {
  publico: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  interno: "bg-muted text-muted-foreground border-muted-foreground/20",
  confidencial: "bg-chart-3/10 text-chart-3 border-chart-3/30",
  restringido: "bg-destructive/10 text-destructive border-destructive/30",
};

const SENSIBILIDAD_ICON: Record<string, JSX.Element> = {
  publico: <Globe2 className="h-3 w-3" />,
  interno: <UsersIcon className="h-3 w-3" />,
  confidencial: <Lock className="h-3 w-3" />,
  restringido: <Lock className="h-3 w-3" />,
};

const FASE_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-muted text-muted-foreground" },
  queued: { label: "En cola RAG", cls: "bg-chart-3/15 text-chart-3" },
  indexed: { label: "Indexado", cls: "bg-chart-2/15 text-chart-2" },
  skipped: { label: "Omitido", cls: "bg-muted text-muted-foreground" },
  error: { label: "Error", cls: "bg-destructive/15 text-destructive" },
};

export default function Documentos() {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<DocumentoExt[]>([]);
  const [taxonomias, setTaxonomias] = useState<Taxonomia[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [taxFilter, setTaxFilter] = useState<string>("todas");
  const [origenFilter, setOrigenFilter] = useState<string>("todos");

  // Storage legacy (contratos / multimedia)
  const [contratosFiles, setContratosFiles] = useState<{ name: string; created_at?: string }[]>([]);
  const [multimediaFiles, setMultimediaFiles] = useState<{ name: string; created_at?: string }[]>([]);

  // OneDrive state
  const [odState, setOdState] = useState<any>(null);
  const [odSyncing, setOdSyncing] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [docs, tax, c, m] = await Promise.all([
      fetchDocumentos({
        taxonomia: taxFilter !== "todas" ? taxFilter : undefined,
        origen: origenFilter !== "todos" ? origenFilter : undefined,
        search: search || undefined,
      }),
      fetchTaxonomias(),
      supabase.storage.from("documentos_contratos").list("general", { limit: 100, sortBy: { column: "created_at", order: "desc" } }),
      supabase.storage.from("multimedia_locales").list("general", { limit: 100, sortBy: { column: "created_at", order: "desc" } }),
    ]);
    setDocumentos(docs);
    setTaxonomias(tax);
    setContratosFiles(((c.data || []) as { name: string; created_at?: string }[]).filter((f) => f.name !== ".emptyFolderPlaceholder"));
    setMultimediaFiles(((m.data || []) as { name: string; created_at?: string }[]).filter((f) => f.name !== ".emptyFolderPlaceholder"));
    if (user?.id) {
      const [s, j] = await Promise.all([fetchOneDriveState(user.id), fetchIngestionJobs(user.id, 5)]);
      setOdState(s);
      setJobs(j);
    }
    setLoading(false);
  }, [search, taxFilter, origenFilter, user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleClassify = async (docId: string) => {
    try {
      await classifyDocument(docId);
      toast.success("Clasificación actualizada");
      loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error clasificando");
    }
  };

  const handleOneDriveSync = async (mode: "backfill" | "delta") => {
    if (!user?.id) return;
    setOdSyncing(true);
    try {
      const r = await startOneDriveSync(user.id, mode);
      if (r.needs_connection) {
        toast.error("Conecta OneDrive desde Ajustes → Conexiones externas");
      } else {
        toast.success(`${r.processed} archivos procesados (${r.skipped} omitidos)${r.has_more ? ", más por procesar" : ""}`);
      }
      loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de sincronización");
    } finally {
      setOdSyncing(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const byTax: Record<string, number> = {};
    let pendingClassify = 0, indexed = 0, queued = 0;
    for (const d of documentos) {
      const codigo = d.taxonomia?.codigo || "sin_clasificar";
      byTax[codigo] = (byTax[codigo] || 0) + 1;
      if (!d.taxonomia_id) pendingClassify++;
      if (d.fase_rag === "indexed") indexed++;
      if (d.fase_rag === "queued") queued++;
    }
    return { byTax, pendingClassify, indexed, queued, total: documentos.length };
  }, [documentos]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestión Documental</h1>
        <p className="text-sm text-muted-foreground">
          Repositorio único con taxonomía, deduplicación y vinculación múltiple. Cada documento se clasifica, se renombra y puede asociarse a varios activos, operadores u operaciones sin duplicarse.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Database className="h-4 w-4 text-chart-1" />} label="Documentos" value={stats.total} />
        <KPI icon={<Tags className="h-4 w-4 text-chart-2" />} label="Sin clasificar" value={stats.pendingClassify} accent={stats.pendingClassify > 0 ? "warning" : undefined} />
        <KPI icon={<Sparkles className="h-4 w-4 text-chart-3" />} label="En cola RAG" value={stats.queued} />
        <KPI icon={<CheckCircle2 className="h-4 w-4 text-chart-2" />} label="Indexados RAG" value={stats.indexed} />
      </div>

      <Tabs defaultValue="catalogo">
        <TabsList>
          <TabsTrigger value="catalogo" className="gap-2"><FolderOpen className="h-4 w-4" /> Catálogo</TabsTrigger>
          <TabsTrigger value="onedrive" className="gap-2"><Cloud className="h-4 w-4" /> OneDrive Sync</TabsTrigger>
          <TabsTrigger value="legacy" className="gap-2"><Upload className="h-4 w-4" /> Subida directa</TabsTrigger>
        </TabsList>

        {/* === CATÁLOGO === */}
        <TabsContent value="catalogo" className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre..." className="pl-9" />
            </div>
            <Select value={taxFilter} onValueChange={setTaxFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {taxonomias.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nombre} {stats.byTax[t.codigo] ? `(${stats.byTax[t.codigo]})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={origenFilter} onValueChange={setOrigenFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los orígenes</SelectItem>
                <SelectItem value="upload">Subida manual</SelectItem>
                <SelectItem value="onedrive">OneDrive</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="plaud">Plaud</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : documentos.length === 0 ? (
                <div className="text-center py-16">
                  <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No hay documentos. Sube archivos o sincroniza OneDrive.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {documentos.map((d) => (
                    <DocumentoRow key={d.id} doc={d} onClassify={() => handleClassify(d.id)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ONEDRIVE === */}
        <TabsContent value="onedrive" className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-primary" /> Sincronización OneDrive
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Backfill inicial (todo lo que tienes en OneDrive) + delta incremental cada vez que añades un archivo nuevo. Los archivos quedan referenciados con su `webUrl` y se deduplican por hash.
                  </p>
                </div>
                <Badge variant={odState?.estado === "idle" ? "outline" : "secondary"} className="shrink-0">
                  {odState?.estado || "no configurado"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <Stat label="Archivos importados" value={odState?.total_archivos || 0} />
                <Stat label="Indexados RAG" value={odState?.archivos_indexados || 0} />
                <Stat label="Último backfill" value={odState?.ultimo_backfill ? new Date(odState.ultimo_backfill).toLocaleDateString("es-ES") : "—"} small />
                <Stat label="Último delta" value={odState?.ultimo_delta ? new Date(odState.ultimo_delta).toLocaleString("es-ES") : "—"} small />
              </div>

              {odState?.ultimo_error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {odState.ultimo_error}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => handleOneDriveSync("backfill")} disabled={odSyncing}>
                  {odSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}
                  Iniciar / continuar backfill
                </Button>
                <Button variant="outline" onClick={() => handleOneDriveSync("delta")} disabled={odSyncing || !odState?.delta_token}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Comprobar nuevos archivos
                </Button>
              </div>

              <p className="text-xs text-muted-foreground border-t pt-3">
                💡 El backfill se procesa por lotes de 200 archivos por invocación para no sobrecargar el sistema. Pulsa "Continuar" hasta que el lote diga 0 nuevos. Después usa el delta cada cierto tiempo.
              </p>
            </CardContent>
          </Card>

          {/* Jobs recientes */}
          {jobs.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="text-sm font-semibold">Trabajos de ingesta recientes</h4>
                <div className="space-y-2">
                  {jobs.map((j) => (
                    <div key={j.id} className="flex items-center justify-between text-xs border rounded-md p-2.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{j.job_type}</Badge>
                        <span className="text-muted-foreground">{new Date(j.created_at).toLocaleString("es-ES")}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{j.processed_items}/{j.total_items} procesados</span>
                        {j.failed_items > 0 && <span className="text-destructive">{j.failed_items} fallos</span>}
                        <Badge variant={j.estado === "completed" ? "default" : j.estado === "failed" ? "destructive" : "secondary"} className="text-[10px]">{j.estado}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === SUBIDA DIRECTA === */}
        <TabsContent value="legacy" className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Subida puntual a buckets clásicos. Para gestión taxonómica usa el catálogo principal y la ingesta automática.
          </p>
          <Tabs defaultValue="contratos">
            <TabsList>
              <TabsTrigger value="contratos" className="gap-2"><FileText className="h-4 w-4" /> Contratos {contratosFiles.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{contratosFiles.length}</Badge>}</TabsTrigger>
              <TabsTrigger value="multimedia" className="gap-2"><ImageIcon className="h-4 w-4" /> Multimedia {multimediaFiles.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{multimediaFiles.length}</Badge>}</TabsTrigger>
            </TabsList>
            <TabsContent value="contratos">
              <Card><CardContent className="p-4">
                <UploadZone bucket="documentos_contratos" folder="general" files={contratosFiles} onUploadComplete={loadAll} />
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="multimedia">
              <Card><CardContent className="p-4">
                <UploadZone bucket="multimedia_locales" folder="general" files={multimediaFiles} onUploadComplete={loadAll} />
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- subcomponents ---------- */
function KPI({ icon, label, value, accent }: { icon: JSX.Element; label: string; value: number | string; accent?: "warning" }) {
  return (
    <Card>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${accent === "warning" ? "bg-chart-3/10" : "bg-muted"}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={small ? "text-sm font-medium" : "text-xl font-bold"}>{value}</p>
    </div>
  );
}

function DocumentoRow({ doc, onClassify }: { doc: DocumentoExt; onClassify: () => void }) {
  const fase = FASE_LABEL[doc.fase_rag] || FASE_LABEL.pending;
  const sensCls = SENSIBILIDAD_STYLES[doc.nivel_sensibilidad] || SENSIBILIDAD_STYLES.interno;
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <FileText className="h-5 w-5 text-muted-foreground/60 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.nombre_normalizado || doc.nombre}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {doc.taxonomia ? (
            <Badge variant="outline" className="text-[10px] h-5 gap-1">
              <Tags className="h-2.5 w-2.5" />{doc.taxonomia.nombre}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-5 bg-chart-3/10 text-chart-3 border-chart-3/30">Sin clasificar</Badge>
          )}
          <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${sensCls}`}>
            {SENSIBILIDAD_ICON[doc.nivel_sensibilidad]} {doc.nivel_sensibilidad}
          </Badge>
          <Badge variant="outline" className={`text-[10px] h-5 ${fase.cls}`}>{fase.label}</Badge>
          <span className="text-[10px] text-muted-foreground">· {doc.origen}</span>
          {doc.tamano_bytes && <span className="text-[10px] text-muted-foreground">· {(doc.tamano_bytes / 1024).toFixed(0)} KB</span>}
        </div>
      </div>
      {!doc.taxonomia_id && (
        <Button size="sm" variant="ghost" onClick={onClassify} className="h-7 text-xs">
          <Sparkles className="h-3 w-3 mr-1" /> Clasificar
        </Button>
      )}
    </div>
  );
}
