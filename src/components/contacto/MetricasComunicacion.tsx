import { MessageCircle, Clock, Calendar, TrendingUp, TrendingDown, Send } from "lucide-react";
import type { PerfilStats } from "@/types/perfilIa";

interface Props {
  stats: PerfilStats;
}

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: typeof MessageCircle;
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | null;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/30 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-semibold text-foreground">{value}</span>
        {trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
        {trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function MetricasComunicacion({ stats }: Props) {
  if (!stats || !stats.total_messages) return null;

  const trend30 = stats.trend_30d_pct;
  const trendDir: "up" | "down" | null =
    trend30 == null ? null : trend30 > 5 ? "up" : trend30 < -5 ? "down" : null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Métricas de comunicación
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <StatCard
          icon={MessageCircle}
          label="Mensajes"
          value={stats.total_messages}
          sub={
            stats.channels?.length
              ? stats.channels.join(" · ")
              : undefined
          }
        />
        <StatCard
          icon={Clock}
          label="Sin contacto"
          value={`${stats.days_since_last}d`}
          sub={
            stats.last_contact
              ? `último: ${new Date(stats.last_contact).toLocaleDateString("es-ES")}`
              : undefined
          }
        />
        <StatCard
          icon={TrendingUp}
          label="Tendencia 30d"
          value={`${trend30 > 0 ? "+" : ""}${trend30}%`}
          trend={trendDir}
        />
        <StatCard
          icon={Send}
          label="Iniciado por nosotros"
          value={`${stats.initiated_by_us_pct}%`}
          sub={
            stats.initiated_by_us_pct < 50
              ? "más nos buscan a nosotros"
              : "más les buscamos nosotros"
          }
        />
        {stats.preferred_hours?.length > 0 && (
          <StatCard
            icon={Clock}
            label="Horas pico"
            value={stats.preferred_hours.map(formatHour).join(", ")}
          />
        )}
        {stats.preferred_days?.length > 0 && (
          <StatCard
            icon={Calendar}
            label="Días preferidos"
            value={stats.preferred_days.join(", ")}
          />
        )}
      </div>
    </div>
  );
}
