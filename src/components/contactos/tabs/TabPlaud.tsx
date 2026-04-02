import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Mic, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TabPlaud({ contacto, onRefresh }: { contacto: any; onRefresh: () => void }) {
  const [recordings, setRecordings] = useState<{ name: string; size: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);

    try {
      const newRecs = Array.from(files).map((f) => ({
        name: f.name,
        size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      }));
      setRecordings((prev) => [...prev, ...newRecs]);

      await supabase.from("contactos").update({
        plaud_count: (contacto.plaud_count || 0) + files.length,
        last_contact: new Date().toISOString(),
        interaction_count: (contacto.interaction_count || 0) + files.length,
      } as any).eq("id", contacto.id);

      toast({ title: `${files.length} grabación(es) añadida(s)` });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error al importar", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [contacto, onRefresh, toast]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Grabaciones Plaud</CardTitle>
          <label>
            <input type="file" accept=".mp3,.wav,.m4a,.webm,.ogg" multiple className="hidden" onChange={handleFiles} />
            <Button variant="outline" size="sm" asChild disabled={importing}>
              <span className="cursor-pointer">
                <Upload className="mr-1.5 h-3.5 w-3.5" /> {importing ? "Importando..." : "Importar grabación"}
              </span>
            </Button>
          </label>
        </CardHeader>
        <CardContent>
          {recordings.length === 0 ? (
            <div className="py-8 text-center">
              <Mic className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">
                Importa grabaciones de reuniones con {contacto.nombre} para tener un registro completo.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recordings.map((r, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="rounded-full bg-chart-3/10 p-2">
                    <Play className="h-3.5 w-3.5 text-chart-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">{r.size}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
