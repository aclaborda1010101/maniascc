import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  disponible: { label: "Disponible", className: "bg-accent/10 text-accent border-accent/20" },
  en_negociacion: { label: "Negociación", className: "bg-chart-5/10 text-chart-5 border-chart-5/20" },
  ocupado: { label: "Ocupado", className: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  reforma: { label: "Reforma", className: "bg-muted text-muted-foreground border-border" },
  pendiente: { label: "Pendiente", className: "bg-chart-5/10 text-chart-5 border-chart-5/20" },
  aprobado: { label: "Aprobado", className: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  descartado: { label: "Descartado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  alto: { label: "Alto", className: "bg-destructive/10 text-destructive border-destructive/20" },
  medio: { label: "Medio", className: "bg-chart-5/10 text-chart-5 border-chart-5/20" },
  bajo: { label: "Bajo", className: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("capitalize", config.className)}>
      {config.label}
    </Badge>
  );
}
