import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  generatedAt?: string;
  empty?: boolean;
  children: ReactNode;
}

/**
 * Wrapper visionOS para la sección "Línea de Vida" (perfil IA).
 * Muestra un chip discreto con la edad del perfil_ia leyendo
 * `generated_at`. Si el perfil está vacío, renderiza un placeholder
 * elegante en su lugar.
 */
export function PerfilIaSection({ generatedAt, empty, children }: Props) {
  const ageLabel = generatedAt
    ? `Generado ${formatDistanceToNow(new Date(generatedAt), {
        addSuffix: true,
        locale: es,
      })}`
    : null;

  return (
    <Card className="p-5 space-y-5 bg-card/40 backdrop-blur-md border-border/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-wide">
            Línea de Vida
          </h2>
        </div>
        {ageLabel && (
          <Badge
            variant="outline"
            className="text-[10px] font-normal text-muted-foreground border-border/50 bg-background/30"
            title={`Perfil IA generado: ${generatedAt}`}
          >
            {ageLabel}
          </Badge>
        )}
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-background/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Perfil pendiente de generación.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Aún no hay suficientes señales para construir la línea de vida
            de este contacto.
          </p>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
