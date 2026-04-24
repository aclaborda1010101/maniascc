import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Circle,
} from "lucide-react";
import type { KeyEvent, Sentiment } from "@/types/perfilIa";

interface Props {
  events: KeyEvent[];
  max?: number;
}

const SENTIMENT_META: Record<
  Sentiment,
  { icon: typeof Circle; cls: string }
> = {
  good: { icon: CheckCircle2, cls: "text-emerald-400" },
  bad: { icon: AlertTriangle, cls: "text-rose-400" },
  neutral: { icon: Circle, cls: "text-muted-foreground" },
};

export function LineaDelTiempo({ events, max = 8 }: Props) {
  if (!events || events.length === 0) return null;
  // Más recientes arriba.
  const sorted = [...events]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, max);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Eventos clave
        </h3>
      </div>
      <ol className="relative border-l border-border/40 ml-1 space-y-3 pl-4">
        {sorted.map((ev, i) => {
          const meta = SENTIMENT_META[ev.score] || SENTIMENT_META.neutral;
          const Icon = meta.icon;
          return (
            <li key={i} className="space-y-0.5">
              <span
                className={`absolute -left-[7px] mt-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-background ${meta.cls}`}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {new Date(ev.date).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
                  {ev.tipo}
                </span>
              </div>
              <p className="text-xs text-foreground/90 leading-snug">
                {ev.description}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
