import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Zap, TrendingUp, Calendar, Clock, Bot, Database, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/* ── Model pricing (EUR per token) ── */
const MODEL_PRICING: Record<string, { input: number; output: number; label: string }> = {
  "gemini-3-flash-preview": {
    input: (0.10 / 1_000_000) * 0.92,
    output: (0.40 / 1_000_000) * 0.92,
    label: "Gemini 3 Flash",
  },
  "gemini-2.5-flash": {
    input: (0.15 / 1_000_000) * 0.92,
    output: (0.60 / 1_000_000) * 0.92,
    label: "Gemini 2.5 Flash",
  },
  "expert-forge-moe": {
    input: (0.10 / 1_000_000) * 0.92,
    output: (0.40 / 1_000_000) * 0.92,
    label: "Expert Forge MoE",
  },
  "google/gemini-3.1-pro-preview": {
    input: (1.25 / 1_000_000) * 0.92,
    output: (10.00 / 1_000_000) * 0.92,
    label: "Gemini 3.1 Pro Preview",
  },
};

const DEFAULT_PRICING = MODEL_PRICING["google/gemini-3.1-pro-preview"];

function estimateCost(log: UsageLog): number {
  if (log.cost_eur && log.cost_eur > 0) return log.cost_eur;
  const pricing = (log.model && MODEL_PRICING[log.model]) || DEFAULT_PRICING;
  return (log.tokens_input || 0) * pricing.input + (log.tokens_output || 0) * pricing.output;
}

type Period = "today" | "week" | "month" | "all";

function periodStart(period: Period): string | null {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (period === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString(); }
  if (period === "month") { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString(); }
  return null;
}

interface UsageLog {
  id: string;
  action_type: string;
  agent_id: string | null;
  agent_label: string | null;
  model: string | null;
  rag_filter: string | null;
  tokens_input: number;
  tokens_output: number;
  cost_eur: number;
  latency_ms: number;
  created_at: string;
}

export default function Consumo() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("month");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["usage_logs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("usage_logs" as never)
        .select("*" as never)
        .eq("user_id" as never, user!.id as never)
        .order("created_at" as never, { ascending: false } as never)
        .limit(500 as never) as { data: UsageLog[] | null };
      return data || [];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!logs) return [];
    const start = periodStart(period);
    if (!start) return logs;
    return logs.filter((l) => l.created_at >= start);
  }, [logs, period]);

  const totals = useMemo(() => {
    let tokensIn = 0, tokensOut = 0, cost = 0, calls = 0;
    for (const l of filtered) {
      tokensIn += l.tokens_input || 0;
      tokensOut += l.tokens_output || 0;
      cost += estimateCost(l);
      calls++;
    }
    return { tokensIn, tokensOut, cost, calls };
  }, [filtered]);

  const periodLabels: Record<Period, string> = {
    today: "Hoy", week: "Última semana", month: "Último mes", all: "Todo",
  };

  const actionColors: Record<string, string> = {
    playground: "bg-purple-500/10 text-purple-600 border-purple-200",
    chat: "bg-blue-500/10 text-blue-600 border-blue-200",
    "expert-forge": "bg-amber-500/10 text-amber-600 border-amber-200",
    matching: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    query: "bg-muted text-muted-foreground",
  };

  function modelLabel(model: string | null): string {
    if (!model) return "—";
    return MODEL_PRICING[model]?.label || model;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Consumo y Costes
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitorización de tokens, latencias y costes estimados
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-44">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(periodLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-4 w-4" /> Llamadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <p className="text-3xl font-bold">{totals.calls}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Tokens Input
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-3xl font-bold">{(totals.tokensIn / 1000).toFixed(1)}k</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Tokens Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-3xl font-bold">{(totals.tokensOut / 1000).toFixed(1)}k</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" /> Coste estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <p className="text-3xl font-bold">{totals.cost.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} €</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pricing reference */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">
            <strong>Modelos activos:</strong>{" "}
            Gemini 3 Flash — Input: $0.10/1M tokens · Output: $0.40/1M tokens{" · "}
            Expert Forge MoE — coste variable según especialista{" · "}
            Conversión ~0.92 €/$
          </p>
        </CardContent>
      </Card>

      {/* Detailed log table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Desglose por consulta ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay registros en este periodo</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Fecha</TableHead>
                    <TableHead className="w-28">Tipo</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Agente</TableHead>
                    <TableHead>RAG</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Coste €</TableHead>
                    <TableHead className="text-right">Latencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log) => {
                    const estCost = estimateCost(log);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleDateString("es-ES", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${actionColors[log.action_type] || actionColors.query}`}>
                            {log.action_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="flex items-center gap-1">
                            <Cpu className="h-3 w-3 text-muted-foreground" />
                            {modelLabel(log.model)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.agent_label ? (
                            <span className="flex items-center gap-1">
                              <Bot className="h-3 w-3" />{log.agent_label}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.rag_filter ? (
                            <span className="flex items-center gap-1">
                              <Database className="h-3 w-3" />{log.rag_filter}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {(log.tokens_input || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {(log.tokens_output || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {estCost.toFixed(5)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {log.latency_ms ? `${(log.latency_ms / 1000).toFixed(1)}s` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
