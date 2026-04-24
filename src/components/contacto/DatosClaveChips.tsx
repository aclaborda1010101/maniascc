import { Badge } from "@/components/ui/badge";

interface Props {
  datos: string[];
  max?: number;
}

/**
 * Hasta `max` chips (default 6) con los datos clave extraídos
 * por la IA sobre el contacto.
 */
export function DatosClaveChips({ datos, max = 6 }: Props) {
  if (!datos || datos.length === 0) return null;
  const visible = datos.slice(0, max);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Datos clave
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((d, i) => (
          <Badge
            key={i}
            variant="outline"
            className="text-[11px] font-normal bg-accent/5 border-accent/20 text-foreground/85"
          >
            {d}
          </Badge>
        ))}
        {datos.length > max && (
          <Badge
            variant="outline"
            className="text-[11px] font-normal text-muted-foreground border-border/40"
          >
            +{datos.length - max}
          </Badge>
        )}
      </div>
    </div>
  );
}
