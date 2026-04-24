import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import { TrendingUp } from "lucide-react";
import type { TimelinePoint } from "@/types/perfilIa";

interface Props {
  timeline: TimelinePoint[];
}

const sentimentColor: Record<string, string> = {
  good: "hsl(var(--chart-2))",
  neutral: "hsl(var(--muted-foreground))",
  bad: "hsl(var(--destructive))",
};

/**
 * Gráfica principal de la línea de vida (mensajes por mes).
 * Si hay menos de 3 puntos, no renderiza nada (el padre puede
 * mostrar fallback con métricas/evolución).
 */
export function LineaDeVida({ timeline }: Props) {
  if (!timeline || timeline.length < 3) return null;

  const data = timeline.map((p) => ({
    month: p.month,
    count: p.count,
    sentiment: p.sentiment,
    label: p.label,
  }));

  const labeledPoints = data.filter((d) => !!d.label);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>Mensajes por mes</span>
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--accent))", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            {labeledPoints.map((p) => (
              <ReferenceDot
                key={p.month}
                x={p.month}
                y={p.count}
                r={5}
                fill={sentimentColor[p.sentiment] || sentimentColor.neutral}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {labeledPoints.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {labeledPoints.map((p) => (
            <span key={p.month}>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                style={{
                  background: sentimentColor[p.sentiment] || sentimentColor.neutral,
                }}
              />
              {p.month} · {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
