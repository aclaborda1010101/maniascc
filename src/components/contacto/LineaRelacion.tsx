import { Card } from "@/components/ui/card";
import { TrendingUp, Handshake, AlertCircle, Star, Calendar, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface Milestone {
  id: string;
  event_at: string;
  tipo: string;
  score: "good" | "neutral" | "bad";
  title: string;
  description?: string | null;
  source_message_id?: string | null;
}

interface Props {
  milestones: Milestone[];
  onMilestoneClick?: (m: Milestone) => void;
}

const tipoIcon: Record<string, typeof TrendingUp> = {
  positivo: TrendingUp,
  acuerdo: Handshake,
  tension: AlertCircle,
  incidencia: AlertCircle,
  hito: Star,
  reunion: Calendar,
  primer_contacto: MessageSquare,
};

const scoreStyle: Record<string, { ring: string; bg: string; dot: string }> = {
  good: {
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
  },
  neutral: {
    ring: "ring-border/60",
    bg: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  bad: {
    ring: "ring-rose-500/40",
    bg: "bg-rose-500/10 text-rose-400",
    dot: "bg-rose-400",
  },
};

/**
 * Línea horizontal de hitos buenos/malos de la relación.
 * Cada hito = un punto en una línea temporal con icono + tooltip.
 */
export function LineaRelacion({ milestones, onMilestoneClick }: Props) {
  if (!milestones || milestones.length === 0) {
    return (
      <Card className="p-5 bg-card/40 backdrop-blur-md border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-wide">
            Línea de la relación
          </h2>
        </div>
        <div className="rounded-xl border border-dashed border-border/60 bg-background/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Sin hitos detectados todavía.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Conecta tu correo o sincroniza WhatsApp para que la IA detecte los
            momentos clave de vuestra relación.
          </p>
        </div>
      </Card>
    );
  }

  // Ordenar cronológicamente
  const sorted = [...milestones].sort(
    (a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime()
  );

  return (
    <Card className="p-5 bg-card/40 backdrop-blur-md border-border/60">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-wide">
            Línea de la relación
          </h2>
        </div>
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Bueno
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" /> Neutro
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Tensión
          </span>
        </div>
      </div>

      {/* Timeline horizontal scrollable */}
      <div className="relative overflow-x-auto pb-2">
        <div className="flex items-stretch gap-3 min-w-max px-1">
          {sorted.map((m, i) => {
            const style = scoreStyle[m.score] || scoreStyle.neutral;
            const Icon = tipoIcon[m.tipo] || Star;
            return (
              <div key={m.id} className="flex flex-col items-center w-[180px]">
                {/* Card con descripción */}
                <button
                  onClick={() => onMilestoneClick?.(m)}
                  className={`w-full text-left rounded-lg border border-border/40 bg-background/40 p-2.5 hover:bg-background/60 transition-colors ring-1 ${style.ring}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`h-3 w-3 ${style.bg.split(" ")[1]}`} />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m.tipo.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-snug line-clamp-2">
                    {m.title}
                  </p>
                  {m.description && (
                    <p className="text-[10px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                      {m.description}
                    </p>
                  )}
                </button>

                {/* Conector vertical y nodo en la línea */}
                <div className="flex flex-col items-center mt-2 w-full relative">
                  <div className="w-px h-3 bg-border/60" />
                  <div
                    className={`w-3 h-3 rounded-full ${style.dot} ring-2 ring-background z-10`}
                  />
                  {/* Línea horizontal */}
                  {i < sorted.length - 1 && (
                    <div className="absolute top-[15px] left-1/2 right-[-12px] h-px bg-border/60" />
                  )}
                  {i > 0 && (
                    <div className="absolute top-[15px] right-1/2 left-[-12px] h-px bg-border/60" />
                  )}
                </div>

                <span className="text-[10px] text-muted-foreground mt-1.5 tabular-nums">
                  {format(new Date(m.event_at), "d MMM yy", { locale: es })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
