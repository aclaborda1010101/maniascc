import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { FlaskConical, Play, RefreshCw, Download, AlertTriangle, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Run = {
  id: string; run_name: string; run_type: string; created_at: string; finished_at: string | null;
  status: string; total_questions: number; accuracy: number | null;
  latency_p50: number | null; latency_p95: number | null; avg_cost: number | null;
  golden_set_version: string;
};

type Question = {
  id: string; code: string | null; category: string; question: string;
  active: boolean; requires_dedup: boolean; requires_operator_enrichment: boolean;
  requires_m365: boolean; requires_scoring: boolean; requires_manual: boolean;
  evaluation_mode: string; source_type_expected: string;
};

export default function GoldenSetPanel() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        supabase.from("golden_runs").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("golden_questions").select("*").order("code", { ascending: true }),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      setRuns((r1.data as Run[]) || []);
      setQuestions((r2.data as Question[]) || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runParcial = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("golden-run", {
        body: { run_type: "parcial" },
      });
      if (error) throw error;
      toast({
        title: "Corrida parcial completada",
        description: `${(data as any)?.total_questions ?? 0} preguntas · accuracy ${((data as any)?.accuracy ?? 0 * 100).toFixed(0)}%`,
      });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "golden_set_v1.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const cols = ["code", "category", "question", "source_type_expected", "evaluation_mode",
      "active", "requires_dedup", "requires_operator_enrichment", "requires_m365", "requires_scoring", "requires_manual"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...questions.map((q: any) => cols.map((c) => esc(q[c])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "golden_set_v1.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => {
    const active = questions.filter((q) => q.active).length;
    const inactive = questions.length - active;
    const by = (k: keyof Question) => questions.filter((q) => (q as any)[k]).length;
    return {
      total: questions.length, active, inactive,
      dedup: by("requires_dedup"),
      operators: by("requires_operator_enrichment"),
      m365: by("requires_m365"),
      scoring: by("requires_scoring"),
      manual: by("requires_manual"),
    };
  }, [questions]);

  const runA = runs.find((r) => r.id === compareA);
  const runB = runs.find((r) => r.id === compareB);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Calidad AVA (golden-set)</CardTitle>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="outline">total {counts.total}</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">activas {counts.active}</Badge>
            <Badge variant="secondary">inactivas {counts.inactive}</Badge>
            <Badge variant="outline">dedup {counts.dedup}</Badge>
            <Badge variant="outline">operadores {counts.operators}</Badge>
            <Badge variant="outline">m365 {counts.m365}</Badge>
            <Badge variant="outline">scoring {counts.scoring}</Badge>
            <Badge variant="outline">manual {counts.manual}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
          <Button variant="outline" size="sm" onClick={exportJSON}><Download className="h-3 w-3 mr-1" />JSON</Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3 w-3 mr-1" />CSV</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <span>El baseline <b>OFICIAL</b> completo requiere dedup validado + cifras financieras confirmadas. Aquí solo se ejecuta el <b>parcial</b> (no financiero, sin dedup, sin M365, sin scoring, sin manual).</span>
        </div>

        <div className="flex gap-2">
          <Button onClick={runParcial} disabled={running}>
            {running ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
            Correr baseline parcial
          </Button>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Corridas recientes</h4>
          {loading ? <Skeleton className="h-40 w-full" /> : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay corridas.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Preguntas</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                    <TableHead className="text-right">p50 / p95</TableHead>
                    <TableHead className="text-right">Coste medio</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{r.run_name}</TableCell>
                      <TableCell><Badge variant={r.run_type === "oficial" ? "default" : "secondary"}>{r.run_type}</Badge></TableCell>
                      <TableCell className="text-right">{r.total_questions}</TableCell>
                      <TableCell className="text-right">{r.accuracy != null ? `${(r.accuracy * 100).toFixed(0)}%` : "—"}</TableCell>
                      <TableCell className="text-right text-xs">{r.latency_p50 ?? 0} / {r.latency_p95 ?? 0} ms</TableCell>
                      <TableCell className="text-right text-xs">{r.avg_cost != null ? `$${Number(r.avg_cost).toFixed(4)}` : "—"}</TableCell>
                      <TableCell><Badge variant={r.status === "done" ? "outline" : "secondary"}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Comparar dos corridas</h4>
          <div className="grid grid-cols-2 gap-2">
            <Select value={compareA} onValueChange={setCompareA}>
              <SelectTrigger><SelectValue placeholder="Corrida A" /></SelectTrigger>
              <SelectContent>{runs.map((r) => <SelectItem key={r.id} value={r.id}>{r.run_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={compareB} onValueChange={setCompareB}>
              <SelectTrigger><SelectValue placeholder="Corrida B" /></SelectTrigger>
              <SelectContent>{runs.map((r) => <SelectItem key={r.id} value={r.id}>{r.run_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {runA && runB && (
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                ["Accuracy", (r: Run) => r.accuracy != null ? `${(r.accuracy * 100).toFixed(1)}%` : "—"],
                ["p50 (ms)", (r: Run) => String(r.latency_p50 ?? "—")],
                ["p95 (ms)", (r: Run) => String(r.latency_p95 ?? "—")],
                ["Coste medio", (r: Run) => r.avg_cost != null ? `$${Number(r.avg_cost).toFixed(4)}` : "—"],
              ].map(([label, fn]: any) => (
                <div key={label} className="border rounded p-2">
                  <p className="text-muted-foreground">{label}</p>
                  <p><span className="font-mono">A</span> {fn(runA)}</p>
                  <p><span className="font-mono">B</span> {fn(runB)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
