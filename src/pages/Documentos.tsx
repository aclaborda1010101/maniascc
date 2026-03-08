import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UploadZone } from "@/components/UploadZone";
import { FileText, Image, FolderOpen } from "lucide-react";

export default function Documentos() {
  const [contratosFiles, setContratosFiles] = useState<any[]>([]);
  const [multimediaFiles, setMultimediaFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = async () => {
    setLoading(true);
    const [c, m] = await Promise.all([
      supabase.storage.from("documentos_contratos").list("general", { limit: 100, sortBy: { column: "created_at", order: "desc" } }),
      supabase.storage.from("multimedia_locales").list("general", { limit: 100, sortBy: { column: "created_at", order: "desc" } }),
    ]);
    setContratosFiles((c.data || []).filter(f => f.name !== ".emptyFolderPlaceholder"));
    setMultimediaFiles((m.data || []).filter(f => f.name !== ".emptyFolderPlaceholder"));
    setLoading(false);
  };

  useEffect(() => { fetchFiles(); }, []);

  const totalFiles = contratosFiles.length + multimediaFiles.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
        <p className="text-sm text-muted-foreground">Gestión documental centralizada de contratos y multimedia</p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
              <FolderOpen className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total archivos</p>
              <p className="text-lg font-bold">{totalFiles}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-chart-1/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-chart-1" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contratos</p>
              <p className="text-lg font-bold">{contratosFiles.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-chart-2/10 flex items-center justify-center">
              <Image className="h-4 w-4 text-chart-2" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Multimedia</p>
              <p className="text-lg font-bold">{multimediaFiles.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="contratos">
        <TabsList>
          <TabsTrigger value="contratos" className="gap-2">
            <FileText className="h-4 w-4" /> Contratos
            {contratosFiles.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{contratosFiles.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="multimedia" className="gap-2">
            <Image className="h-4 w-4" /> Multimedia
            {multimediaFiles.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{multimediaFiles.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contratos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Documentos de Contratos
              </CardTitle>
              <p className="text-sm text-muted-foreground">Contratos, acuerdos y documentación legal. Bucket privado (solo usuarios autenticados).</p>
            </CardHeader>
            <CardContent>
              <UploadZone
                bucket="documentos_contratos"
                folder="general"
                files={contratosFiles}
                onUploadComplete={fetchFiles}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multimedia">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" /> Multimedia de Locales
              </CardTitle>
              <p className="text-sm text-muted-foreground">Fotos, planos y vídeos de locales comerciales. Bucket público.</p>
            </CardHeader>
            <CardContent>
              <UploadZone
                bucket="multimedia_locales"
                folder="general"
                files={multimediaFiles}
                onUploadComplete={fetchFiles}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
