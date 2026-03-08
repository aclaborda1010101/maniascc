import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  proyectoId: string;
  operadores: any[];
  availableOps: any[];
  onRefresh: () => void;
}

export function ProyectoOperadores({ proyectoId, operadores, availableOps, onRefresh }: Props) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const addOperador = async (opId: string) => {
    const { error } = await supabase.from("proyecto_operadores").insert({ proyecto_id: proyectoId, operador_id: opId });
    if (!error) { setDialogOpen(false); onRefresh(); }
    else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const removeOperador = async (rowId: string) => {
    await supabase.from("proyecto_operadores").delete().eq("id", rowId);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{operadores.length} operador{operadores.length !== 1 ? "es" : ""}</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
    </div>
  );
}
