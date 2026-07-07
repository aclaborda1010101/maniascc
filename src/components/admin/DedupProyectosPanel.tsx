import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Loader2, GitMerge, Info, RefreshCw, AlertTriangle, ShieldCheck, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Candidato = {
  key: string;
  norm_key: string;
  confidence: "alta" | "media" | "baja";
  evidencia: string;
  canonical: { id: string; nombre: string; descripcion: string | null; comision_total: any; created_at: string };
  duplicates: { id: string; nombre: string; descripcion: string | null; comision_total: any; created_at: string }[];
  total: number;
};

type MismaMarca = {
  norm_key: string;
  nombre_ejemplo: string;
  total: number;
  items: { id: string; nombre: string; descripcion: string | null; ubicacion: string | null; comision_total: any; dedup_status: string }[];
};

type Contadores = { sin_revisar: number; duplicate_candidate: number; confirmed_duplicate: number; not_duplicate: number };

export default function DedupProyectosPanel() {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [mismaMarca, setMismaMarca] = useState<MismaMarca[]>([]);
  const [contadores, setContadores] = useState<Contadores | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("proyectos-dedup", {
        body: { action: "detectar" },
      });
      if (error) throw error;
      setCandidatos((data as any)?.candidatos || []);
      setMismaMarca((data as any)?.misma_marca_distintos || []);
      setContadores((data as any)?.contadores || null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const confirmarFusion = async (g: Candidato) => {
    setBusy(g.key);
    try {
      const { data, error } = await supabase.functions.invoke("proyectos-dedup", {
        body: {
          action: "confirmar_duplicado",
          canonical_id: g.canonical.id,
          duplicate_ids: g.duplicates.map((d) => d.id),
        },
      });
      if (error) throw error;
      const rep = Object.entries((data as any)?.repunteadas || {})
        .map(([t, n]) => `${t}:${n}`).join(", ");
      toast({ title: "Fusión confirmada", description: `${g.duplicates.length} duplicados fusionados. ${rep}` });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Error al fusionar", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const marcarNoDuplicado = async (ids: string[], key: string) => {
    setBusy(key);
    try {
      const { error } = await supabase.functions.invoke("proyectos-dedup", {
        body: { action: "marcar_no_duplicado", ids },
      });
      if (error) throw error;
      toast({ title: "Marcados como no-duplicado", description: `${ids.length} proyectos` });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
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
          {contadores && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="outline">sin revisar: {contadores.sin_revisar}</Badge>
              <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 border-amber-500/30">candidatos: {contadores.duplicate_candidate}</Badge>
              <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30">confirmados: {contadores.confirmed_duplicate}</Badge>
              <Badge variant="secondary">no-dup: {contadores.not_duplicate}</Badge>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sección A: candidatos a duplicado */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">A. Candidatos a duplicado (revisar)</h3>
            <Badge variant="secondary">{candidatos.length} grupos</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Clave normalizada del nombre + descripción + comisión coinciden. NO se fusiona sin tu confirmación.
          </p>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : candidatos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin candidatos pendientes.</p>
          ) : (
            <div className="space-y-2">
              {candidatos.map((g) => (
                <div key={g.key} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{g.canonical.nombre}</p>
                        <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">
                          confianza {g.confidence}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">clave: <code>{g.norm_key}</code></p>
                      {g.canonical.descripcion && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{g.canonical.descripcion}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {g.total} filas ({g.duplicates.length} redundantes) · comisión {g.canonical.comision_total || "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Canónico: <code className="text-[10px]">{g.canonical.id.slice(0, 8)}</code> · evidencia: {g.evidencia}
                      </p>
                      <details className="mt-1">
                        <summary className="text-[11px] text-muted-foreground cursor-pointer">Ver variantes ({g.duplicates.length})</summary>
                        <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5 pl-3">
                          {g.duplicates.map((d) => (
                            <li key={d.id} className="truncate">· "{d.nombre}" <code className="text-[10px]">{d.id.slice(0, 8)}</code></li>
                          ))}
                        </ul>
                      </details>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" disabled={busy === g.key}>
                            {busy === g.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ShieldCheck className="h-3 w-3 mr-1" />Confirmar fusión</>}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Fusionar {g.duplicates.length} duplicados</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se repuntarán las referencias al canónico <code>{g.canonical.id.slice(0, 8)}</code>.
                              Los duplicados quedarán marcados como <b>fusionado</b> (soft-delete). Idempotente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => confirmarFusion(g)}>Confirmar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        variant="outline" size="sm"
                        disabled={busy === g.key}
                        onClick={() => marcarNoDuplicado([g.canonical.id, ...g.duplicates.map((d) => d.id)], g.key)}
                      >
                        <X className="h-3 w-3 mr-1" /> No son duplicados
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sección B: misma marca, operaciones distintas */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">B. Misma marca, operaciones distintas</h3>
            <Badge variant="outline">{mismaMarca.length} grupos</Badge>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <span><b>NO son duplicados.</b> Misma clave normalizada pero operaciones legítimas distintas (fases, ciudades, locales).</span>
          </div>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : mismaMarca.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin grupos.</p>
          ) : (
            <div className="space-y-2">
              {mismaMarca.map((g) => (
                <div key={g.norm_key} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{g.nombre_ejemplo} <Badge variant="secondary" className="ml-1">×{g.total}</Badge></p>
                      <p className="text-[11px] text-muted-foreground">clave: <code>{g.norm_key}</code></p>
                      <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {g.items.slice(0, 5).map((it) => (
                          <li key={it.id} className="truncate">
                            · {it.ubicacion || "sin ubicación"} — {(it.descripcion || "sin descripción").slice(0, 80)}
                          </li>
                        ))}
                        {g.items.length > 5 && <li>· … y {g.items.length - 5} más</li>}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => desambiguar(g.items.map((i) => i.id))}>
                        <Info className="h-3 w-3 mr-1" /> Desambiguar
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => marcarNoDuplicado(g.items.map((i) => i.id), g.norm_key)}
                      >
                        <X className="h-3 w-3 mr-1" /> Marcar no-dup
                      </Button>
                    </div>
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
