import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreGauge } from "./ScoreGauge";

interface Operador {
  nombre: string;
  sector: string;
  rol: string;
  renta_estimada?: number;
}

interface Plan {
  plan: string;
  perfil: string;
  operadores_recomendados: Operador[];
  score_sinergia_total: number;
  prediccion_ocupacion: number;
  renta_estimada_total?: number;
  riesgos?: string[];
}

interface PlanComparisonGridProps {
  planes: Plan[];
  className?: string;
}

const planColors: Record<string, string> = {
  A: "border-chart-2",
  B: "border-accent",
  C: "border-chart-3",
};

const planLabels: Record<string, string> = {
  A: "🏆 Máximo Valor",
  B: "⚖️ Equilibrado",
  C: "🛡️ Seguridad",
};

export function PlanComparisonGrid({ planes, className }: PlanComparisonGridProps) {
  if (!planes.length) return <p className="text-sm text-muted-foreground">Sin planes generados.</p>;

  return (
    <div className={cn("grid gap-4 md:grid-cols-3", className)}>
      {planes.map((plan) => (
        <div key={plan.plan} className={cn("rounded-xl border-2 bg-card p-4 space-y-3", planColors[plan.plan] || "border-border")}>
          <div className="text-center">
            <h4 className="text-lg font-bold">Plan {plan.plan}</h4>
            <p className="text-sm text-muted-foreground">{planLabels[plan.plan] || plan.perfil}</p>
          </div>

          <div className="flex justify-center">
            <ScoreGauge score={plan.prediccion_ocupacion} label="Ocupación %" size="sm" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-xs text-muted-foreground">Sinergia</div>
              <div className="text-sm font-bold">{plan.score_sinergia_total?.toFixed(1) || "—"}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-xs text-muted-foreground">Renta est.</div>
              <div className="text-sm font-bold">{plan.renta_estimada_total ? `${(plan.renta_estimada_total / 1000).toFixed(0)}k€` : "—"}</div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Operador</TableHead>
                <TableHead className="text-xs">Rol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.operadores_recomendados.map((op, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium py-1">{op.nombre}</TableCell>
                  <TableCell className="text-xs py-1">
                    <Badge variant="outline" className="text-[10px]">{op.rol}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {plan.riesgos && plan.riesgos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-destructive mb-1">⚠️ Riesgos</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {plan.riesgos.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
