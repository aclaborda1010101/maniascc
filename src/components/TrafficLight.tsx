import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";

type Color = "verde" | "amarillo" | "rojo";

interface TrafficLightProps {
  color: Color;
  label?: string;
  detail?: string;
  className?: string;
}

const config: Record<Color, { bg: string; text: string; icon: typeof ShieldCheck; label: string }> = {
  verde: { bg: "bg-chart-2/15", text: "text-chart-2", icon: ShieldCheck, label: "OK" },
  amarillo: { bg: "bg-chart-3/15", text: "text-chart-3", icon: ShieldAlert, label: "Alerta" },
  rojo: { bg: "bg-destructive/15", text: "text-destructive", icon: AlertTriangle, label: "Riesgo" },
};

export function TrafficLight({ color, label, detail, className }: TrafficLightProps) {
  const c = config[color] || config.verde;
  const Icon = c.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg p-3", c.bg, className)}>
      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", c.text)} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", c.text)}>{c.label}</span>
          {label && <span className="text-sm font-medium text-foreground">{label}</span>}
        </div>
        {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}
