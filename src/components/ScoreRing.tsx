import { cn } from "@/lib/utils";

interface ScoreRingProps {
  value: number; // 0-100
  size?: number;
  label?: string;
  colorScheme?: "score" | "match" | "risk";
  className?: string;
  showLabel?: boolean;
}

/**
 * Circular score gauge with gradient stroke.
 * Used in LocalDetail, Matching and Dashboard hot opportunity cards.
 */
export function ScoreRing({
  value,
  size = 88,
  label,
  colorScheme = "score",
  className,
  showLabel = true,
}: ScoreRingProps) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = Math.max(4, Math.round(size * 0.08));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / 100) * circumference;

  // Unique gradient id per render to avoid SVG collisions
  const gradId = `ring-${colorScheme}-${size}-${Math.random().toString(36).slice(2, 7)}`;

  const gradients: Record<string, [string, string]> = {
    // verde lima → cian (score principal)
    score: ["hsl(145 80% 55%)", "hsl(190 95% 60%)"],
    // cian → violeta (match)
    match: ["hsl(190 95% 60%)", "hsl(265 90% 65%)"],
    // ámbar → rojo (risk)
    risk: ["hsl(38 92% 55%)", "hsl(0 84% 60%)"],
  };
  const [from, to] = gradients[colorScheme];

  // Tipografía proporcional al diámetro
  const numberSize = Math.round(size * 0.32);
  const labelSize = Math.max(9, Math.round(size * 0.11));

  return (
    <div
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          fill="none"
          opacity={0.5}
        />
        {/* progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 600ms cubic-bezier(.22,.61,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="font-bold tracking-tight text-foreground"
          style={{ fontSize: numberSize }}
        >
          {safe}
        </span>
        {showLabel && label && (
          <span
            className="uppercase tracking-widest text-muted-foreground mt-1"
            style={{ fontSize: labelSize }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
