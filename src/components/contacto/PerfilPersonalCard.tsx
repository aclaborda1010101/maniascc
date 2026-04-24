import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Eye,
  Lock,
  Info,
  ChevronDown,
  ChevronRight,
  Heart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PerfilPersonal, TonoEmocional } from "@/types/perfilIa";

interface Props {
  data: PerfilPersonal;
  contactoId: string;
}

const tonoLabel: Record<TonoEmocional, string> = {
  positivo: "Positivo",
  neutral: "Neutral",
  tenso: "Tenso",
  variable: "Variable",
};

const tonoClasses: Record<TonoEmocional, string> = {
  positivo: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  neutral: "bg-muted/40 text-muted-foreground border-border/50",
  tenso: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  variable: "bg-amber-500/15 text-amber-300 border-amber-400/30",
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/50 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Registra en `usage_logs` el desbloqueo de datos personales sensibles.
 * Fire-and-forget: nunca bloquea la UI.
 *
 * Shape de la tabla: action_type=text, metadata=jsonb. La spec original
 * pide `target_type`/`target_id` como columnas; aquí van dentro de metadata
 * para encajar con el schema vigente sin migración.
 */
async function logReveal(contactoId: string) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;
    await supabase.from("usage_logs").insert({
      user_id: userId,
      action_type: "reveal_perfil_personal",
      metadata: {
        target_type: "contacto",
        target_id: contactoId,
      },
    });
  } catch (err) {
    // No bloquear la UI por un fallo de log.
    console.warn("[PerfilPersonalCard] usage_logs insert failed:", err);
  }
}

export function PerfilPersonalCard({ data, contactoId }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [openPersonalidad, setOpenPersonalidad] = useState(false);

  const handleReveal = () => {
    setRevealed(true);
    void logReveal(contactoId);
  };

  if (!revealed) {
    return (
      <Card className="p-5 space-y-4 bg-card/40 backdrop-blur-md border-border/60">
        <div className="flex items-start gap-2">
          <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-wide">
              Perfil personal
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">
              Información sensible
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Intereses, personalidad, eventos personales y tono emocional inferidos
          desde emails. Su acceso queda registrado.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReveal}
          className="bg-accent/10 border-accent/30 hover:bg-accent/20 gap-1.5"
        >
          <Eye className="h-4 w-4" />
          Ver perfil personal
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-4 bg-card/40 backdrop-blur-md border-border/60">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2">
        <Info className="h-3.5 w-3.5 text-amber-300/80 mt-0.5 shrink-0" />
        <p className="text-[11px] text-amber-100/80 leading-relaxed">
          Información sensible inferida por IA desde emails. Usar con criterio.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Heart className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-wide">
              Perfil personal
            </h3>
            {data.relacion_con_fran && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {data.relacion_con_fran}
              </p>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] font-medium border shrink-0 ${tonoClasses[data.tono_emocional_promedio]}`}
        >
          {tonoLabel[data.tono_emocional_promedio]}
        </Badge>
      </div>

      {/* Intereses */}
      {data.intereses?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1.5">
            Intereses
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.intereses.map((i, idx) => (
              <Chip key={`${i}-${idx}`}>{i}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* Personalidad (colapsable) */}
      {data.personalidad?.length > 0 && (
        <Collapsible
          open={openPersonalidad}
          onOpenChange={setOpenPersonalidad}
        >
          <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors">
            {openPersonalidad ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Personalidad
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 pl-5">
            <div className="flex flex-wrap gap-1.5">
              {data.personalidad.map((p, idx) => (
                <Chip key={`${p}-${idx}`}>{p}</Chip>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Eventos personales (solo si hay) */}
      {data.eventos_personales?.length > 0 && (
        <div className="pt-3 border-t border-border/40">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1.5">
            Eventos personales
          </p>
          <ul className="space-y-1.5">
            {data.eventos_personales.map((e, idx) => (
              <li
                key={`${e}-${idx}`}
                className="flex items-start gap-2 text-xs text-foreground/80"
              >
                <Lock className="h-3 w-3 text-muted-foreground/70 mt-0.5 shrink-0" />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pie */}
      <p className="text-[10px] text-muted-foreground/60 italic pt-2 border-t border-border/40">
        Basado en análisis de emails — confidencial
      </p>
    </Card>
  );
}
