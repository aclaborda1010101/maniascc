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
  good: "hsl(var(--acc-3))",       // verde menta
  neutral: "hsl(var(--acc-1))",    // cian (neutral pero vivo)
  bad: "hsl(var(--destructive))",  // rojo
};

const sentimentLabel: Record<string, string> = {
  good: "Buena",
  neutral: "Neutra",
  bad: "Tensa",
};

/**
 * Gráfica principal de la línea de vida (mensajes por mes).
 * - La línea cambia de color a lo largo del tiempo según sentiment dominante
 *   (gradiente segmentado por punto).
 * - Cada dot se pinta con el color del sentiment de ese mes.
 * - ReferenceDot extra (halo) sólo en puntos con label.
 * Si hay menos de 3 puntos, no renderiza nada.
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
  const n = data.length;

  // Stops del gradiente: cada punto fija un stop con su color de sentiment.
  // Esto produce una transición suave de verde→cian→rojo a lo largo de la línea.
  const gradientStops = data.map((d, i) => ({
    offset: `${(i / Math.max(1, n - 1)) * 100}%`,
    color: sentimentColor[d.sentiment] || sentimentColor.neutral,
  }));

  const presentSentiments = Array.from(new Set(data.map((d) => d.sentiment)));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>Mensajes por mes</span>
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="lineaVidaGradient" x1="0" y1="0" x2="1" y2="0">
                {gradientStops.map((s, i) => (
                  <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={1} />
                ))}
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.25}
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
                border: "1px solid hsl(var(--border) / 0.2)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(value: number, _name, props) => {
                const s = (props?.payload?.sentiment as string) || "neutral";
                return [`${value} · ${sentimentLabel[s] || s}`, "Mensajes"];
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="url(#lineaVidaGradient)"
              strokeWidth={2.25}
              dot={(props: any) => {
                const { cx, cy, payload, index } = props;
                if (cx == null || cy == null) return <g key={index} />;
                const color =
                  sentimentColor[payload?.sentiment as string] ||
                  sentimentColor.neutral;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill={color}
                    stroke="hsl(var(--background))"
                    strokeWidth={1}
                  />
                );
              }}
              activeDot={{ r: 5 }}
            />
            {labeledPoints.map((p) => (
              <ReferenceDot
                key={p.month}
                x={p.month}
                y={p.count}
                r={6}
                fill={sentimentColor[p.sentiment] || sentimentColor.neutral}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda + eventos etiquetados */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {presentSentiments.map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: sentimentColor[s] || sentimentColor.neutral }}
              />
              {sentimentLabel[s] || s}
            </span>
          ))}
        </div>
        {labeledPoints.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground/80">
            {labeledPoints.map((p) => (
              <span key={p.month} className="inline-flex items-center gap-1">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
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
    </div>
  );
}
