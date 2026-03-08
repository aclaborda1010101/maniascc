import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Sinergia {
  operador_a: string;
  operador_b: string;
  tipo: string;
  coeficiente: number;
}

interface SynergyMatrixProps {
  sinergias: Sinergia[];
  className?: string;
}

export function SynergyMatrix({ sinergias, className }: SynergyMatrixProps) {
  if (!sinergias.length) return <p className="text-sm text-muted-foreground">Sin datos de sinergia.</p>;

  const getColor = (coef: number) => {
    if (coef >= 0.5) return "bg-chart-2/80 text-chart-2-foreground";
    if (coef >= 0.1) return "bg-chart-2/40";
    if (coef >= -0.1) return "bg-muted";
    if (coef >= -0.5) return "bg-chart-3/40";
    return "bg-destructive/60 text-destructive-foreground";
  };

  const getLabel = (tipo: string) => {
    if (tipo === "sinergia_positiva" || tipo === "sinergia") return "🤝";
    if (tipo === "canibalizacion") return "⚔️";
    if (tipo === "ancla") return "⚓";
    return "🔄";
  };

  return (
    <div className={cn("grid gap-2", className)} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))` }}>
      {sinergias.map((s, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <div className={cn("rounded-lg p-3 text-center cursor-default transition-colors", getColor(s.coeficiente))}>
              <div className="text-lg">{getLabel(s.tipo)}</div>
              <div className="text-xs font-medium mt-1 truncate">{s.operador_a}</div>
              <div className="text-xs text-muted-foreground">×</div>
              <div className="text-xs font-medium truncate">{s.operador_b}</div>
              <div className="text-sm font-bold mt-1">{s.coeficiente > 0 ? "+" : ""}{s.coeficiente.toFixed(2)}</div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{s.tipo}: {s.operador_a} + {s.operador_b} = {s.coeficiente.toFixed(2)}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
