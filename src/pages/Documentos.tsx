import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadZone } from "@/components/UploadZone";
import { FileText } from "lucide-react";

export default function Documentos() {
  const [contratosFiles, setContratosFiles] = useState<any[]>([]);
  const [multimediaFiles, setMultimediaFiles] = useState<any[]>([]);

  const fetchFiles = async () => {
    const [c, m] = await Promise.all([
      supabase.storage.from("documentos_contratos").list("", { limit: 100 }),
      supabase.storage.from("multimedia_locales").list("", { limit: 100 }),
    ]);
    setContratosFiles((c.data || []).filter(f => f.name !== ".emptyFolderPlaceholder"));
    setMultimediaFiles((m.data || []).filter(f => f.name !== ".emptyFolderPlaceholder"));
  };

  useEffect(() => { fetchFiles(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
        <p className="text-muted-foreground">Gestión documental centralizada</p>
      </div>

      <Tabs defaultValue="contratos">
        <TabsList>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="multimedia">Multimedia Locales</TabsTrigger>
        </TabsList>

        <TabsContent value="contratos">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Documentos de Contratos</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Multimedia de Locales</CardTitle></CardHeader>
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
