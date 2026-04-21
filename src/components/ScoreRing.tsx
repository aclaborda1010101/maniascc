import { cn } from "@/lib/utils";

interface ScoreRingProps {
  value: number; // 0-100
  size?: number;
  label?: string;
  colorScheme?: "score" | "match" | "risk" | "mint";
  className?: string;
  showLabel?: boolean;
}

/**
 * Circular score gauge with iridescent gradient stroke.
 * visionOS aesthetic: soft halo behind, large display number, optional label.
 */
export function ScoreRing({
  value,
  size = 88,
  label,
  colorScheme = "match",
  className,
  showLabel = true,
}: ScoreRingProps) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = Math.max(4, Math.round(size * 0.075));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / 100) * circumference;

  // Unique gradient id per render to avoid SVG collisions
  const gradId = `ring-${colorScheme}-${size}-${Math.random().toString(36).slice(2, 7)}`;

  const gradients: Record<string, [string, string]> = {
    // mint → blue (score viabilidad)
    score: ["hsl(var(--acc-4))", "hsl(var(--acc-1))"],
    // blue → violet → pink (match iridescent)
    match: ["hsl(var(--acc-1))", "hsl(var(--acc-2))"],
    // mint dominant
    mint: ["hsl(var(--acc-4))", "hsl(var(--acc-1))"],
    // amber → coral (risk)
    risk: ["hsl(var(--acc-5))", "hsl(var(--acc-3))"],
  };
  const [from, to] = gradients[colorScheme];

  const numberSize = Math.round(size * 0.34);
  const labelSize = Math.max(9, Math.round(size * 0.085));

  return (
    <div
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {/* Soft halo glow behind ring */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${from}33 0%, transparent 70%)`,
          filter: "blur(20px)",
          transform: "scale(1.1)",
        }}
      />

      <svg width={size} height={size} className="-rotate-90 relative">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(0 0% 100% / 0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Progress */}
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
          className="font-display font-semibold tabular-nums tracking-tight text-white"
          style={{ fontSize: numberSize, letterSpacing: "-0.04em" }}
        >
          {safe}
        </span>
        {showLabel && label && (
          <span
            className="uppercase tracking-[0.15em] text-white/55 font-medium mt-1"
            style={{ fontSize: labelSize }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
