import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreGauge({ score, label, size = "md", className }: ScoreGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const sizes = { sm: 80, md: 120, lg: 160 };
  const s = sizes[size];
  const strokeWidth = size === "sm" ? 6 : size === "md" ? 8 : 10;
  const radius = (s - strokeWidth) / 2;
  const circumference = Math.PI * radius; // semicircle
  const offset = circumference - (clampedScore / 100) * circumference;

  const getColor = (v: number) => {
    if (v >= 75) return "hsl(var(--chart-2))";
    if (v >= 50) return "hsl(var(--chart-3))";
    if (v >= 25) return "hsl(var(--chart-1))";
    return "hsl(var(--destructive))";
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width={s} height={s / 2 + 10} viewBox={`0 0 ${s} ${s / 2 + 10}`}>
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${s / 2} A ${radius} ${radius} 0 0 1 ${s - strokeWidth / 2} ${s / 2}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M ${strokeWidth / 2} ${s / 2} A ${radius} ${radius} 0 0 1 ${s - strokeWidth / 2} ${s / 2}`}
          fill="none"
          stroke={getColor(clampedScore)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <text
          x={s / 2}
          y={s / 2 - 2}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: size === "sm" ? 18 : size === "md" ? 26 : 34, fontWeight: 700 }}
        >
          {clampedScore}
        </text>
      </svg>
      {label && <span className="text-xs text-muted-foreground mt-1">{label}</span>}
    </div>
  );
}
