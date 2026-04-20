import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, File, Trash2, RefreshCw, Loader2, FileText, Sparkles, Tag, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ingestDocument } from "@/services/ragService";
import { classifyDocument, linkDocument, fetchTaxonomias, type Taxonomia } from "@/services/documentService";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  proyectoId: string;
  docs: any[];
  onRefresh: () => void;
}

export function ProyectoDocumentos({ proyectoId, docs, onRefresh }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [docTipo, setDocTipo] = useState("auto");
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [classifying, setClassifying] = useState<string | null>(null);
  const [taxonomias, setTaxonomias] = useState<Taxonomia[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, classified: 0, indexed: 0 });

  useEffect(() => {
    fetchTaxonomias().then(setTaxonomias);
  }, []);

  const pendientes = useMemo(
    () => docs.filter((d) => !d.taxonomia_id || !d.procesado_ia),
    [docs]
  );

  const readSample = async (file: File): Promise<string> => {
    if (file.type.startsWith("text/") || /\.(txt|md|csv|json|html|xml|eml)$/i.test(file.name)) {
      try { return (await file.text()).slice(0, 4000); } catch { return ""; }
    }
    return "";
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const storagePath = `proyectos/${proyectoId}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("documentos_contratos").upload(storagePath, file);
        if (uploadErr) throw uploadErr;
        const { data: docRow, error: insertErr } = await supabase.from("documentos_proyecto").insert({
          proyecto_id: proyectoId, nombre: file.name, storage_path: storagePath,
          mime_type: file.type, tamano_bytes: file.size,
          tipo_documento: docTipo === "auto" ? null : docTipo,
          subido_por: user.id, owner_id: user.id, origen: "upload", fase_rag: "pending",
        }).select("id").single();
        if (insertErr) throw insertErr;
        if (docRow) {
          await linkDocument(docRow.id, "proyecto", proyectoId, "oportunidad").catch(() => {});

          const sample = await readSample(file);
          classifyDocument(docRow.id, sample).then((res: any) => {
            if (res?.ok) {
              toast({
                title: `"${file.name}" catalogado`,
                description: `Categoría: ${res.taxonomia_codigo} · Sensibilidad: ${res.nivel_sensibilidad}`,
              });
              onRefresh();
            }
          }).catch(() => {});

          ingestDocument(docRow.id).then((res) => {
            if (res.success) {
              toast({ title: `"${file.name}" indexado`, description: `${res.chunks_created} fragmentos · ${res.dominio || "general"}` });
              onRefresh();
            }
          });
        }
      }
      toast({ title: `${fileList.length} archivo(s) subido(s)`, description: "Catalogación IA e indexación en marcha…" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error al subir", description: e.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const handleDownload = async (storagePath: string) => {
    const { data } = await supabase.storage.from("documentos_contratos").createSignedUrl(storagePath, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (docId: string, storagePath: string) => {
    await supabase.storage.from("documentos_contratos").remove([storagePath]);
    await supabase.from("documentos_proyecto").delete().eq("id", docId);
    toast({ title: "Documento eliminado" });
    onRefresh();
  };

  const handleIngest = async (docId: string) => {
    setIngesting(docId);
    const result = await ingestDocument(docId);
    if (result.success) { toast({ title: `Indexado: ${result.chunks_created} fragmentos`, description: `Dominio: ${result.dominio || "general"}` }); onRefresh(); }
    else toast({ title: "Error al indexar", description: result.error, variant: "destructive" });
    setIngesting(null);
  };

  const handleReclassify = async (docId: string, nombre: string) => {
    setClassifying(docId);
    try {
      const res: any = await classifyDocument(docId);
      if (res?.ok) {
        toast({ title: `Reclasificado: ${nombre}`, description: `Categoría: ${res.taxonomia_codigo}` });
        onRefresh();
      }
    } catch (e: any) {
      toast({ title: "Error al clasificar", description: e.message, variant: "destructive" });
    }
    setClassifying(null);
  };

  // Procesa N a la vez para no saturar el edge function ni el AI gateway
  const runBulk = async () => {
    if (pendientes.length === 0) return;
    setBulkRunning(true);
    const total = pendientes.length;
    setBulkProgress({ done: 0, total, classified: 0, indexed: 0 });
    let classified = 0, indexed = 0;
    const CHUNK = 3;
    for (let i = 0; i < pendientes.length; i += CHUNK) {
      const slice = pendientes.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        slice.map(async (d) => {
          const r: { c: boolean; i: boolean } = { c: false, i: false };
          if (!d.taxonomia_id) {
            try { const res: any = await classifyDocument(d.id); if (res?.ok) r.c = true; } catch {}
          }
          if (!d.procesado_ia) {
            try { const res = await ingestDocument(d.id); if (res.success) r.i = true; } catch {}
          }
          return r;
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          if (r.value.c) classified++;
          if (r.value.i) indexed++;
        }
      }
      setBulkProgress({ done: Math.min(i + CHUNK, total), total, classified, indexed });
    }
    setBulkRunning(false);
    toast({
      title: `Procesamiento completado`,
      description: `${classified} clasificados · ${indexed} indexados de ${total}`,
    });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Subir documentos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm whitespace-nowrap">Categoría:</Label>
            <Select value={docTipo} onValueChange={setDocTipo}>
              <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">🤖 Auto (clasificar con IA)</SelectItem>
                {taxonomias.map((t) => (
                  <SelectItem key={t.id} value={t.codigo}>{t.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> La IA detecta tipo, sensibilidad y normaliza el nombre
            </span>
          </div>
          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${dragOver ? "border-accent bg-accent/5" : "border-border"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            onClick={() => document.getElementById("doc-upload-input")?.click()}
          >
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{uploading ? "Subiendo..." : "Arrastra archivos aquí o haz clic"}</p>
            <p className="text-xs text-muted-foreground mt-1">Catalogación automática por taxonomía + indexación RAG</p>
            <input type="file" multiple className="hidden" id="doc-upload-input" onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">{docs.length} documento{docs.length !== 1 ? "s" : ""}</CardTitle>
          {pendientes.length > 0 && (
            <Button
              size="sm"
              variant="default"
              onClick={runBulk}
              disabled={bulkRunning}
              className="gap-2"
              title="Clasificar e indexar todos los documentos pendientes"
            >
              {bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {bulkRunning
                ? `Procesando ${bulkProgress.done}/${bulkProgress.total}…`
                : `Clasificar todo (${pendientes.length} pendientes)`}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {bulkRunning && (
            <div className="mb-4 space-y-1">
              <Progress value={(bulkProgress.done / Math.max(1, bulkProgress.total)) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {bulkProgress.classified} clasificados · {bulkProgress.indexed} indexados
              </p>
            </div>
          )}
          {docs.length === 0 ? (
            <div className="py-8 text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="text-muted-foreground text-sm">No hay documentos aún.</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Categoría IA</TableHead><TableHead>Sensibilidad</TableHead><TableHead>Tamaño</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {docs.map((doc) => {
                  const taxCodigo = doc.taxonomia?.codigo || doc.tipo_documento;
                  const taxNombre = doc.taxonomia?.nombre || doc.tipo_documento || "Sin clasificar";
                  const sens = doc.nivel_sensibilidad || "interno";
                  const sensColor = sens === "confidencial" || sens === "restringido" ? "destructive" : sens === "publico" ? "default" : "secondary";
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2"><File className="h-4 w-4 text-muted-foreground shrink-0" /><span className="truncate max-w-[200px]" title={doc.nombre_normalizado || doc.nombre}>{doc.nombre}</span></div>
                        {doc.nombre_normalizado && doc.nombre_normalizado !== doc.nombre && (
                          <div className="text-[10px] text-muted-foreground ml-6 truncate max-w-[200px]" title={doc.nombre_normalizado}>→ {doc.nombre_normalizado}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {taxCodigo ? (
                          <Badge variant="outline" className="text-xs gap-1"><Tag className="h-3 w-3" />{taxNombre}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">Pendiente IA</Badge>
                        )}
                      </TableCell>
                      <TableCell><Badge variant={sensColor as any} className="text-[10px] h-5 capitalize">{sens}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{doc.tamano_bytes ? `${(doc.tamano_bytes / 1024).toFixed(0)} KB` : "—"}</TableCell>
                      <TableCell>{doc.procesado_ia ? <Badge variant="secondary" className="text-[10px] h-5">Indexado ✓</Badge> : <Badge variant="outline" className="text-[10px] h-5">Pendiente</Badge>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{doc.created_at ? new Date(doc.created_at).toLocaleDateString("es-ES") : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleReclassify(doc.id, doc.nombre)} disabled={classifying === doc.id} title="Clasificar/Re-clasificar con IA">
                            {classifying === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(doc.storage_path)} title="Descargar"><Download className="h-4 w-4" /></Button>
                          {!doc.procesado_ia && <Button variant="ghost" size="icon" onClick={() => handleIngest(doc.id)} disabled={ingesting === doc.id} title="Indexar">{ingesting === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id, doc.storage_path)} className="text-muted-foreground hover:text-destructive" title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
