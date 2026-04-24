import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Moon } from "lucide-react";
import type { EvolutionBlock, EvolutionStatus } from "@/types/perfilIa";

interface Props {
  evolution: EvolutionBlock;
}

const STATUS_META: Record<
  EvolutionStatus,
  { label: string; icon: typeof TrendingUp; cls: string }
> = {
  mejorando: {
    label: "Mejorando",
    icon: TrendingUp,
    cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  estable: {
    label: "Estable",
    icon: Minus,
    cls: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
  },
  deteriorando: {
    label: "Deteriorando",
    icon: TrendingDown,
    cls: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
  dormida: {
    label: "Dormida",
    icon: Moon,
    cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
};

export function EvolucionReciente({ evolution }: Props) {
  const meta = STATUS_META[evolution?.status] || STATUS_META.estable;
  const Icon = meta.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Evolución
        </h3>
        <Badge variant="outline" className={`text-[10px] gap-1 ${meta.cls}`}>
          <Icon className="h-3 w-3" /> {meta.label}
        </Badge>
      </div>

      {evolution?.summary && (
        <p className="text-sm leading-relaxed text-foreground/90">
          {evolution.summary}
        </p>
      )}

      {evolution?.recent_evolution?.length > 0 && (
        <ul className="space-y-1.5">
          {evolution.recent_evolution.map((r, i) => (
            <li key={i} className="text-xs text-muted-foreground flex gap-2">
              <span className="text-foreground/70 font-medium min-w-[120px]">
                {r.when}:
              </span>
              <span className="flex-1">{r.desc}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
