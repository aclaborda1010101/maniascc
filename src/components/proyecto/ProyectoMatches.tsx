import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Download, FileText } from "lucide-react";
import { MatchCard } from "@/components/MatchCard";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  proyecto: any;
  matches: any[];
  allLocales: any[];
  onRefreshMatches: () => void;
}

export function ProyectoMatches({ proyecto, matches, allLocales, onRefreshMatches }: Props) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<{ latency_ms?: number; modelo?: string; ai_enhanced?: boolean } | null>(null);
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "estado">("score_desc");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterSector, setFilterSector] = useState("todos");

  const handleGenerate = async () => {
    if (!proyecto?.local_id) {
      toast({ title: "Error", description: "Este proyecto no tiene un local asignado.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setLastResult(null);
    const { data, error } = await supabase.functions.invoke("generate-match", {
      body: { local_id: proyecto.local_id },
    });
    setGenerating(false);
    if (error) {
      toast({ title: "Error al generar matches", description: error.message, variant: "destructive" });
    } else {
      setLastResult({ latency_ms: data?.latency_ms, modelo: data?.modelo, ai_enhanced: data?.ai_enhanced });
      toast({ title: `${data?.matches?.length || 0} matches generados`, description: `Modelo: ${data?.modelo || "rule-based"} · ${data?.latency_ms || 0}ms` });
      onRefreshMatches();
    }
  };

  const sectors = [...new Set(matches.map((m: any) => (m.tags || []).find((t: string) => t.startsWith("sector_"))?.replace("sector_", "").replace(/_/g, " ")).filter(Boolean))];
  const filtered = matches
    .filter((m: any) => filterEstado === "todos" || m.estado === filterEstado)
    .filter((m: any) => {
      if (filterSector === "todos") return true;
      return (m.tags || []).some((t: string) => t === `sector_${filterSector.replace(/ /g, "_")}`);
    })
    .sort((a: any, b: any) => {
      if (sortBy === "score_desc") return b.score - a.score;
      if (sortBy === "score_asc") return a.score - b.score;
      return a.estado.localeCompare(b.estado);
    });

  const exportCSV = () => {
    const header = "Operador,Score,Estado,Tags,Explicación\n";
    const rows = filtered.map((m: any) => {
      const nombre = ((m.operadores as any)?.nombre || "").replace(/"/g, '""');
      return `"${nombre}",${m.score},"${m.estado}","${(m.tags || []).join("; ")}","${(m.explicacion || "").replace(/"/g, '""')}"`;
    }).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `matches_${proyecto?.nombre?.replace(/\s+/g, "_") || "proyecto"}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: `CSV exportado (${filtered.length} matches)` });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Motor de Matching IA</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {proyecto?.local_id ? "Genera matches entre el local del proyecto y los operadores activos." : "Asigna un local al proyecto para poder generar matches."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastResult && <span className="text-xs text-muted-foreground">{lastResult.modelo} · {lastResult.latency_ms}ms{lastResult.ai_enhanced && " · ✨ IA"}</span>}
            <Button onClick={handleGenerate} disabled={generating || !proyecto?.local_id} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {generating ? "Generando…" : "Generar Matches"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {matches.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold">{matches.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-chart-2">{matches.filter((m: any) => m.score >= 70).length}</p><p className="text-xs text-muted-foreground">Score ≥ 70</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-chart-1">{matches.filter((m: any) => ["sugerido", "pendiente"].includes(m.estado)).length}</p><p className="text-xs text-muted-foreground">Pendientes</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-accent">{matches.filter((m: any) => ["contactado", "exito"].includes(m.estado)).length}</p><p className="text-xs text-muted-foreground">Contactados</p></CardContent></Card>
        </div>
      )}

      {generating && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => <Card key={i} className="border-l-4 border-l-muted"><CardContent className="py-6 space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>)}
        </div>
      )}

      {/* Filters + cards */}
      {!generating && matches.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="score_desc">Score ↓</SelectItem>
                <SelectItem value="score_asc">Score ↑</SelectItem>
                <SelectItem value="estado">Estado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="sugerido">Sugerido</SelectItem>
                <SelectItem value="contactado">Contactado</SelectItem>
                <SelectItem value="descartado">Descartado</SelectItem>
                <SelectItem value="exito">Éxito</SelectItem>
              </SelectContent>
            </Select>
            {sectors.length > 1 && (
              <Select value={filterSector} onValueChange={setFilterSector}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los sectores</SelectItem>
                  {sectors.map((s: any) => <SelectItem key={s} value={s}>{String(s).charAt(0).toUpperCase() + String(s).slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{filtered.length} de {matches.length}</span>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportCSV}><Download className="h-3.5 w-3.5" /> CSV</Button>
            </div>
          </div>
          {filtered.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((m: any, i: number) => <MatchCard key={m.id} match={m} index={i} onUpdate={onRefreshMatches} />)}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Ningún match coincide con los filtros.</p>
          )}
        </>
      )}

      {!generating && matches.length === 0 && (
        <Card><CardContent className="py-12 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">
            {proyecto?.local_id ? 'No hay matches todavía. Pulsa "Generar Matches" para empezar.' : "Asigna un local al proyecto desde la pestaña Resumen para habilitar el matching."}
          </p>
        </CardContent></Card>
      )}
    </div>
  );
}
