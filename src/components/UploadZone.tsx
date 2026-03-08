import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface UploadZoneProps {
  bucket: string;
  folder: string;
  files: { name: string; created_at?: string }[];
  onUploadComplete: () => void;
}

export function UploadZone({ bucket, folder, files, onUploadComplete }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const path = `${folder}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file);
        if (error) throw error;
      }
      toast({ title: "Archivo subido correctamente" });
      onUploadComplete();
    } catch (e: any) {
      toast({ title: "Error al subir", description: e.message, variant: "destructive" });
    }
    setUploading(false);
  }, [bucket, folder, onUploadComplete, toast]);

  const handleDownload = async (fileName: string) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(`${folder}/${fileName}`, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (fileName: string) => {
    const { error } = await supabase.storage.from(bucket).remove([`${folder}/${fileName}`]);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else onUploadComplete();
  };

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          dragOver ? "border-accent bg-accent/5" : "border-border"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
      >
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="mb-2 text-sm text-muted-foreground">
          {uploading ? "Subiendo..." : "Arrastra archivos aquí o haz clic"}
        </p>
        <input
          type="file"
          multiple
          className="hidden"
          id={`upload-${folder}`}
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button variant="outline" size="sm" onClick={() => document.getElementById(`upload-${folder}`)?.click()} disabled={uploading}>
          Seleccionar archivos
        </Button>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.name} className="flex items-center justify-between rounded-md border bg-card p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{f.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleDownload(f.name)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(f.name)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
