import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, Trash2, FileText, History, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listGeneratedDocuments,
  downloadGeneratedDocument,
  deleteGeneratedDocument,
  type DocumentoGenerado,
} from "@/services/generadorHistoryService";
import { downloadBlob } from "@/services/pdfService";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

interface Props {
  onOpenPreview?: (doc: DocumentoGenerado) => void;
}

export function GeneradorHistorial({ onOpenPreview }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documentos-generados"],
    queryFn: listGeneratedDocuments,
  });

  const handleDownload = async (doc: DocumentoGenerado) => {
    setBusyId(doc.id);
    const { blob, error } = await downloadGeneratedDocument(doc);
    setBusyId(null);
    if (error || !blob) {
      toast({ title: "No disponible", description: error || "No se encontró el PDF", variant: "destructive" });
      return;
    }
    downloadBlob(blob, `${doc.titulo || doc.mode_label}.pdf`);
  };

  const handleDelete = async (doc: DocumentoGenerado) => {
    if (!confirm(`¿Eliminar "${doc.titulo}"?`)) return;
    setBusyId(doc.id);
    const { error } = await deleteGeneratedDocument(doc);
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["documentos-generados"] });
    toast({ title: "Documento eliminado" });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Historial</h3>
        <Badge variant="secondary" className="text-xs ml-auto">{docs.length}</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aún no has generado documentos.</p>
          <p className="text-xs mt-1">Los documentos generados se guardarán aquí automáticamente.</p>
        </div>
      ) : (
        <ScrollArea className="h-[480px] pr-3">
          <div className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="rounded-md border border-border p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{doc.titulo || doc.mode_label}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] py-0 h-4">{doc.mode_label}</Badge>
                      <span>{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: es })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-1 mt-2">
                  {onOpenPreview && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => onOpenPreview(doc)}
                    >
                      <Eye className="h-3 w-3 mr-1" /> Abrir
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    disabled={busyId === doc.id || !doc.storage_path}
                    onClick={() => handleDownload(doc)}
                  >
                    {busyId === doc.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <><Download className="h-3 w-3 mr-1" /> PDF</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive ml-auto"
                    disabled={busyId === doc.id}
                    onClick={() => handleDelete(doc)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
