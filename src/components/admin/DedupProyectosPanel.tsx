import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Loader2, GitMerge, Info, RefreshCw, AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type DupGroup = {
  key: string;
  canonical: { id: string; nombre: string; descripcion: string | null; comision_total: any; created_at: string };
  duplicates: { id: string; nombre: string; descripcion: string | null; comision_total: any; created_at: string }[];
  nombre: string;
  descripcion: string | null;
  comision_total: any;
  total: number;
};

type SameNameGroup = {
  nombre: string;
  total: number;
  items: { id: string; descripcion: string | null; ubicacion: string | null; comision_total: any }[];
};

export default function DedupProyectosPanel() {
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);
  const [dups, setDups] = useState<DupGroup[]>([]);
  const [sameName, setSameName] = useState<SameNameGroup[]>([]);
  const [counts, setCounts] = useState<{ activos: number; fusionados: number } | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        supabase.functions.invoke("proyectos-dedup", { body: { action: "detectar_duplicados_reales" } }),
        supabase.functions.invoke("proyectos-dedup", { body: { action: "detectar_mismo_nombre_distintos" } }),
        supabase.from("proyectos").select("merge_status"),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      setDups((r1.data?.grupos as DupGroup[]) || []);
      setSameName((r2.data?.grupos as SameNameGroup[]) || []);
      const rows = (r3.data as any[]) || [];
      setCounts({
        activos: rows.filter((r) => r.merge_status === "activo").length,
        fusionados: rows.filter((r) => r.merge_status === "fusionado").length,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const fusionarGrupo = async (grupo: DupGroup) => {
    setMerging(grupo.key);
    try {
      const { data, error } = await supabase.functions.invoke("proyectos-dedup", {
        body: {
          action: "fusionar",
          canonical_id: grupo.canonical.id,
          duplicate_ids: grupo.duplicates.map((d) => d.id),
        },
      });
      if (error) throw error;
      const rep = Object.entries((data as any)?.repunteadas || {})
        .map(([t, n]) => `${t}:${n}`).join(", ");
      toast({ title: "Grupo fusionado", description: `${grupo.duplicates.length} duplicados marcados. Repunteado: ${rep}` });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Error al fusionar", description: e.message, variant: "destructive" });
    } finally {
      setMerging(null);
    }
  };

  const desambiguar = async (ids: string[]) => {
    try {
      const { data, error } = await supabase.functions.invoke("proyectos-dedup", {
        body: { action: "desambiguar", ids },
      });
      if (error) throw error;
      toast({ title: "Nombres desambiguados", description: `${(data as any)?.actualizados ?? 0} proyectos actualizados` });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><GitMerge className="h-4 w-4" /> Deduplicación de proyectos</CardTitle>
          {counts && (
            <p className="text-xs text-muted-foreground mt-1">
              {counts.activos} activos · {counts.fusionados} fusionados
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sección A: duplicados reales */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">A. Duplicados reales (seguros de fusionar)</h3>
            <Badge variant="secondary">{dups.length} grupos</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Nombre + descripción + comisión IDÉNTICOS. Origen típico: doble importación del CRM.
          </p>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : dups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No hay duplicados reales pendientes.</p>
          ) : (
            <div className="space-y-2">
              {dups.map((g) => (
                <div key={g.key} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{g.nombre}</p>
                      {g.descripcion && <p className="text-xs text-muted-foreground line-clamp-2">{g.descripcion}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Comisión: {g.comision_total || "—"} · {g.total} filas ({g.duplicates.length} redundantes)
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Canónico (más antiguo): <code className="text-[10px]">{g.canonical.id.slice(0, 8)}</code>
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" disabled={merging === g.key}>
                          {merging === g.key ? <Loader2 className="h-3 w-3 animate-spin" /> : "Fusionar grupo"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Fusionar {g.duplicates.length} duplicados</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se repuntarán todas las referencias (contactos, operadores, actividad, documentos, chunks, etc.)
                            de los {g.duplicates.length} duplicados al proyecto canónico <code>{g.canonical.id.slice(0, 8)}</code>.
                            Los duplicados quedarán marcados como <b>fusionado</b> (soft-delete, no se borran).
                            Esta acción es idempotente pero conviene revisar.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => fusionarGrupo(g)}>Fusionar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sección B: mismo nombre, distintas operaciones */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">B. Mismo nombre, operaciones distintas</h3>
            <Badge variant="outline">{sameName.length} grupos</Badge>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <span><b>NO son duplicados.</b> Son operaciones legítimas distintas del mismo centro/marca (fases, ciudades, locales). No las fusiones.</span>
          </div>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : sameName.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin colisiones de nombre.</p>
          ) : (
            <div className="space-y-2">
              {sameName.map((g) => (
                <div key={g.nombre} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{g.nombre} <Badge variant="secondary" className="ml-1">×{g.total}</Badge></p>
                      <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {g.items.slice(0, 5).map((it) => (
                          <li key={it.id} className="truncate">
                            · {it.ubicacion || "sin ubicación"} — {(it.descripcion || "sin descripción").slice(0, 80)}
                          </li>
                        ))}
                        {g.items.length > 5 && <li>· … y {g.items.length - 5} más</li>}
                      </ul>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => desambiguar(g.items.map((i) => i.id))}>
                      <Info className="h-3 w-3 mr-1" /> Desambiguar nombres
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
