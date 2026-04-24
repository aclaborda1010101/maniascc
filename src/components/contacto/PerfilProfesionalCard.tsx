import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { NivelDecision, PerfilProfesional } from "@/types/perfilIa";

interface Props {
  data: PerfilProfesional;
}

const nivelLabel: Record<NivelDecision, string> = {
  decisor: "Decisor",
  ejecutor: "Ejecutor",
  influencer: "Influencer",
  info: "Info",
};

/**
 * Paleta visionOS coherente con el resto de la app.
 * Usamos clases con opacidades sutiles sobre el glass de fondo.
 */
const nivelClasses: Record<NivelDecision, string> = {
  decisor: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  ejecutor: "bg-blue-500/15 text-blue-300 border-blue-400/30",
  influencer: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  info: "bg-muted/40 text-muted-foreground border-border/50",
};

function Chip({
  children,
  emphasis = false,
}: {
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <span
      className={
        emphasis
          ? "inline-flex items-center rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-[11px] font-medium text-accent"
          : "inline-flex items-center rounded-full border border-border/50 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground"
      }
    >
      {children}
    </span>
  );
}

export function PerfilProfesionalCard({ data }: Props) {
  const [openEstilo, setOpenEstilo] = useState(false);
  const [openPatrones, setOpenPatrones] = useState(false);

  return (
    <Card className="p-5 space-y-4 bg-card/40 backdrop-blur-md border-border/60">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Briefcase className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-wide truncate">
              {data.cargo_actual || "—"}
              {data.empresa_actual && (
                <span className="text-muted-foreground font-normal">
                  {" @ "}
                  {data.empresa_actual}
                </span>
              )}
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">
              Perfil profesional
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] font-medium border ${nivelClasses[data.nivel_decision]}`}
        >
          {nivelLabel[data.nivel_decision]}
        </Badge>
      </div>

      {/* Sector + skills */}
      {(data.sector || data.skills_detectadas?.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {data.sector && <Chip emphasis>{data.sector}</Chip>}
          {data.skills_detectadas?.map((s, i) => (
            <Chip key={`${s}-${i}`}>{s}</Chip>
          ))}
        </div>
      )}

      {/* Estilo y fortalezas */}
      {(data.estilo_comunicacion || data.fortalezas?.length > 0) && (
        <Collapsible open={openEstilo} onOpenChange={setOpenEstilo}>
          <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors">
            {openEstilo ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Sparkles className="h-3 w-3 text-accent" />
            Estilo y fortalezas
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2 pl-5">
            {data.estilo_comunicacion && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {data.estilo_comunicacion}
              </p>
            )}
            {data.fortalezas?.length > 0 && (
              <ul className="text-xs space-y-1 list-disc list-inside text-foreground/80">
                {data.fortalezas.map((f, i) => (
                  <li key={`${f}-${i}`}>{f}</li>
                ))}
              </ul>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Patrones de negociación */}
      {data.patrones_negociacion?.length > 0 && (
        <Collapsible open={openPatrones} onOpenChange={setOpenPatrones}>
          <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors">
            {openPatrones ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <TrendingUp className="h-3 w-3 text-accent" />
            Patrones de negociación
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 pl-5">
            <ul className="text-xs space-y-1 list-disc list-inside text-foreground/80">
              {data.patrones_negociacion.map((p, i) => (
                <li key={`${p}-${i}`}>{p}</li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Pie: trayectoria + proyectos */}
      {(data.trayectoria?.length > 0 ||
        data.proyectos_mencionados?.length > 0) && (
        <div className="pt-3 border-t border-border/40 space-y-3">
          {data.trayectoria?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                Trayectoria
              </p>
              <ol className="space-y-1 border-l border-border/40 pl-3">
                {data.trayectoria.map((t, i) => (
                  <li
                    key={`${t}-${i}`}
                    className="relative text-xs text-foreground/80"
                  >
                    <span className="absolute -left-[14px] top-1.5 h-1.5 w-1.5 rounded-full bg-accent/60" />
                    {t}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {data.proyectos_mencionados?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                Proyectos mencionados
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.proyectos_mencionados.map((p, i) => (
                  <Chip key={`${p}-${i}`}>{p}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
