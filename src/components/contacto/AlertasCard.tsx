import { Card } from "@/components/ui/card";
import { AlertTriangle, Lightbulb, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ContactAlert {
  id: string;
  tipo: string;
  severity: string;
  mensaje: string;
}

interface Props {
  alerts: ContactAlert[];
  onDismiss: (id: string) => void;
}

const tipoIcon: Record<string, typeof AlertTriangle> = {
  inactividad: Clock,
  oportunidad: Lightbulb,
  riesgo: AlertTriangle,
  compromiso_pendiente: AlertTriangle,
  seguimiento: Clock,
};

const sevColor: Record<string, string> = {
  info: "text-accent border-accent/30 bg-accent/5",
  warn: "text-amber-400 border-amber-500/30 bg-amber-500/5",
  high: "text-rose-400 border-rose-500/30 bg-rose-500/5",
};

export function AlertasCard({ alerts, onDismiss }: Props) {
  const active = alerts.filter((a) => a);

  return (
    <Card className="p-4 bg-card/40 backdrop-blur-md border-border/60">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Alertas e ideas
        </h3>
        {active.length > 0 && (
          <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">
            {active.length}
          </span>
        )}
      </div>

      {active.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Todo en orden ✨
        </p>
      ) : (
        <ul className="space-y-2 max-h-[180px] overflow-y-auto">
          {active.slice(0, 5).map((a) => {
            const Icon = tipoIcon[a.tipo] || AlertTriangle;
            return (
              <li
                key={a.id}
                className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs ${
                  sevColor[a.severity] || sevColor.info
                }`}
              >
                <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p className="flex-1 leading-snug">{a.mensaje}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDismiss(a.id)}
                  className="h-5 w-5 -mr-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
