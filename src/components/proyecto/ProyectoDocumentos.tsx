import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, File, Trash2, RefreshCw, Loader2, FileText, Sparkles, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ingestDocument } from "@/services/ragService";
import { classifyDocument, linkDocument } from "@/services/documentService";
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Subir documentos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm whitespace-nowrap">Categoría:</Label>
            <Select value={docTipo} onValueChange={setDocTipo}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">🤖 Auto (clasificar con IA)</SelectItem>
                <SelectItem value="contrato">Contrato / Legal</SelectItem>
                <SelectItem value="financiero">Financiero</SelectItem>
                <SelectItem value="dossier">Dossier / Presentación</SelectItem>
                <SelectItem value="informe">Informe</SelectItem>
                <SelectItem value="plano">Plano / Arquitectura</SelectItem>
                <SelectItem value="correo">Correo histórico</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
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
        <CardHeader className="pb-3"><CardTitle className="text-base">{docs.length} documento{docs.length !== 1 ? "s" : ""}</CardTitle></CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <div className="py-8 text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="text-muted-foreground text-sm">No hay documentos aún.</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>Tamaño</TableHead><TableHead>Estado IA</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><File className="h-4 w-4 text-muted-foreground shrink-0" /><span className="truncate max-w-[200px]">{doc.nombre}</span></div></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs capitalize">{doc.tipo_documento || "—"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{doc.tamano_bytes ? `${(doc.tamano_bytes / 1024).toFixed(0)} KB` : "—"}</TableCell>
                    <TableCell>{doc.procesado_ia ? <Badge variant="secondary" className="text-[10px] h-5">Indexado ✓</Badge> : <Badge variant="outline" className="text-[10px] h-5">Pendiente</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{doc.created_at ? new Date(doc.created_at).toLocaleDateString("es-ES") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(doc.storage_path)} title="Descargar"><Download className="h-4 w-4" /></Button>
                        {!doc.procesado_ia && <Button variant="ghost" size="icon" onClick={() => handleIngest(doc.id)} disabled={ingesting === doc.id} title="Indexar">{ingesting === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id, doc.storage_path)} className="text-muted-foreground hover:text-destructive" title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
