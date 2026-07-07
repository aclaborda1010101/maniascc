import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardCopy, Plus, Trash2, Tag } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  proyectoId: string;
  proyectoNombre: string;
}

export function ProyectoAliasesYAsunto({ proyectoId, proyectoNombre }: Props) {
  const [aliases, setAliases] = useState<{ id: string; alias: string }[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("project_aliases").select("id,alias").eq("proyecto_id", proyectoId).order("created_at");
    setAliases(data || []);
  };
  useEffect(() => { load(); }, [proyectoId]);

  const copySubject = async () => {
    const prefix = `[${proyectoNombre}] `;
    try {
      await navigator.clipboard.writeText(prefix);
      toast({ title: "Copiado", description: "Pega esto en el asunto del correo." });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const addAlias = async () => {
    const a = newAlias.trim();
    if (a.length < 3) { toast({ title: "Alias demasiado corto (mín. 3 caracteres)" }); return; }
    setLoading(true);
    const { error } = await supabase.from("project_aliases").insert({ proyecto_id: proyectoId, alias: a });
    setLoading(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewAlias("");
    load();
  };

  const removeAlias = async (id: string) => {
    await supabase.from("project_aliases").delete().eq("id", id);
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" /> Correo & aliases</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={copySubject}>
                  <ClipboardCopy className="h-3.5 w-3.5 mr-1" /> Copiar asunto para email
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pega esto en el asunto y AVA clasificará el correo automáticamente.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <code className="text-xs bg-muted px-2 py-1 rounded">[{proyectoNombre}] </code>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Aliases adicionales que AVA reconocerá al clasificar correos de este proyecto.</p>
          <div className="flex flex-wrap gap-2">
            {aliases.length === 0 && <span className="text-xs text-muted-foreground">Sin aliases.</span>}
            {aliases.map((a) => (
              <Badge key={a.id} variant="secondary" className="gap-1 pl-2 pr-1">
                {a.alias}
                <button onClick={() => removeAlias(a.id)} className="ml-1 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newAlias} onChange={(e) => setNewAlias(e.target.value)} placeholder="p. ej. Torre Málaga" className="h-9" onKeyDown={(e) => e.key === "Enter" && addAlias()} />
            <Button size="sm" onClick={addAlias} disabled={loading}><Plus className="h-3.5 w-3.5 mr-1" /> Añadir</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
