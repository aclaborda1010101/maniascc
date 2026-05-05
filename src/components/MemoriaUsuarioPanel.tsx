import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Brain, Trash2, RefreshCw, Sparkles, User as UserIcon } from "lucide-react";

interface UserMemoryRow {
  id: string;
  key: string;
  value: string;
  category: string | null;
  source: "user_explicit" | "ai_inferred";
  last_used_at: string;
  updated_at: string;
}

function fmtFecha(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function MemoriaUsuarioPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserMemoryRow[]>([]);

  const cargar = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ava_user_memory" as any)
        .select("id, key, value, category, source, last_used_at, updated_at")
        .order("last_used_at", { ascending: false });
      if (error) throw error;
      setRows((data || []) as unknown as UserMemoryRow[]);
    } catch (e: any) {
      toast({ title: "Error cargando memoria", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [user?.id]);

  const eliminar = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    const { error } = await supabase.from("ava_user_memory" as any).delete().eq("id", id);
    if (error) {
      setRows(prev);
      toast({ title: "No se pudo eliminar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Hecho eliminado", description: "AVA dejará de recordarlo." });
    }
  };

  const borrarTodo = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("ava_user_memory" as any)
      .delete()
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "No se pudo borrar", description: error.message, variant: "destructive" });
    } else {
      setRows([]);
      toast({ title: "Memoria borrada", description: "AVA empieza de cero contigo." });
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, UserMemoryRow[]>();
    for (const r of rows) {
      const cat = r.category || "general";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="glass p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-sm">Lo que AVA recuerda sobre ti</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Estos hechos se inyectan en cada conversación para que AVA no tenga que volver a preguntarlos.
              Se añaden cuando le pides "recuerda que…" o cuando confirmas un patrón que ha detectado.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="rounded-2xl border-border/40" onClick={cargar} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refrescar
            </Button>
            {rows.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-2xl border-destructive/40 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Borrar toda
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Borrar toda la memoria?</AlertDialogTitle>
                    <AlertDialogDescription>
                      AVA olvidará todos los hechos que ha guardado sobre ti. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={borrarTodo} className="bg-destructive hover:bg-destructive/90">
                      Borrar todo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass p-8 text-center">
          <UserIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium">AVA aún no recuerda nada sobre ti</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
            Dile cosas como <em>"recuerda que trabajo habitualmente con Burger King"</em> o
            <em> "siempre prefiero los informes en formato breve"</em> y aparecerán aquí.
          </p>
        </div>
      ) : (
        grouped.map(([cat, items]) => (
          <div key={cat} className="glass p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-sm capitalize">{cat}</h3>
              <span className="chip">{items.length}</span>
            </div>
            <div className="overflow-x-auto -mx-4 px-4">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-widest h-8">Clave</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest h-8">Valor</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest h-8 w-24">Origen</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest h-8 w-20">Usado</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest h-8 w-12 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r) => (
                    <TableRow key={r.id} className="border-border/30">
                      <TableCell className="py-2 font-mono text-xs">{r.key}</TableCell>
                      <TableCell className="py-2 text-sm leading-snug">{r.value}</TableCell>
                      <TableCell className="py-2">
                        {r.source === "user_explicit" ? (
                          <span className="chip text-[10px]" style={{ borderColor: "hsl(var(--acc-4) / 0.35)", color: "hsl(var(--acc-4))" }}>
                            <UserIcon className="h-2.5 w-2.5" /> tú
                          </span>
                        ) : (
                          <span className="chip text-[10px]" style={{ borderColor: "hsl(var(--acc-2) / 0.35)", color: "hsl(var(--acc-2))" }}>
                            <Sparkles className="h-2.5 w-2.5" /> AVA
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">{fmtFecha(r.last_used_at)}</TableCell>
                      <TableCell className="text-right py-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => eliminar(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
