import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { User, Briefcase, Target, Shield, MessageSquare } from "lucide-react";

interface NegotiatorCardProps {
  nombre: string;
  empresa?: string;
  cargo?: string;
  estilo_primario: string;
  estilo_secundario?: string;
  fortalezas?: string[];
  debilidades?: string[];
  probabilidad_cierre?: number;
  formato_preferido?: string;
  className?: string;
}

const estiloConfig: Record<string, { emoji: string; color: string }> = {
  competitivo: { emoji: "🦁", color: "bg-destructive/10 text-destructive" },
  colaborativo: { emoji: "🤝", color: "bg-chart-2/10 text-chart-2" },
  analitico: { emoji: "🔬", color: "bg-accent/10 text-accent" },
  expresivo: { emoji: "🎭", color: "bg-chart-5/10 text-chart-5" },
  evitador: { emoji: "🐢", color: "bg-chart-3/10 text-chart-3" },
};

export function NegotiatorCard({
  nombre, empresa, cargo, estilo_primario, estilo_secundario,
  fortalezas, debilidades, probabilidad_cierre, formato_preferido, className,
}: NegotiatorCardProps) {
  const estilo = estiloConfig[estilo_primario] || estiloConfig.colaborativo;

  return (
    <div className={cn("rounded-xl border bg-card p-5 space-y-4", className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-2xl">
            {estilo.emoji}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{nombre}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {empresa && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{empresa}</span>}
              {cargo && <span>· {cargo}</span>}
            </div>
          </div>
        </div>
        {probabilidad_cierre != null && (
          <div className="text-right">
            <div className="text-2xl font-bold">{probabilidad_cierre}%</div>
            <div className="text-xs text-muted-foreground">Prob. cierre</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge className={estilo.color}>{estilo.emoji} {estilo_primario.charAt(0).toUpperCase() + estilo_primario.slice(1)}</Badge>
        {estilo_secundario && (
          <Badge variant="outline">{(estiloConfig[estilo_secundario]?.emoji || "🔄")} {estilo_secundario.charAt(0).toUpperCase() + estilo_secundario.slice(1)}</Badge>
        )}
        {formato_preferido && (
          <Badge variant="secondary"><MessageSquare className="h-3 w-3 mr-1" />{formato_preferido}</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fortalezas && fortalezas.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-xs font-medium text-chart-2 mb-1"><Shield className="h-3 w-3" /> Fortalezas</div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {fortalezas.map((f, i) => <li key={i}>• {f}</li>)}
            </ul>
          </div>
        )}
        {debilidades && debilidades.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-xs font-medium text-destructive mb-1"><Target className="h-3 w-3" /> Debilidades</div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {debilidades.map((d, i) => <li key={i}>• {d}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
