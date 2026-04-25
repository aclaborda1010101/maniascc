import { Card } from "@/components/ui/card";
import { Sparkles, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface NextAction {
  title: string;
  when?: string | null;
  why?: string;
}

interface Props {
  action: NextAction | null | undefined;
  onGenerate?: () => void;
  generating?: boolean;
}

export function ProximaAccionCard({ action, onGenerate, generating }: Props) {
  if (!action || !action.title) {
    return (
      <Card className="p-4 bg-gradient-to-br from-accent/5 to-transparent border-accent/20 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Próxima acción
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Sin acción sugerida todavía.
        </p>
        {onGenerate && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="mt-3 text-xs text-accent hover:underline inline-flex items-center gap-1"
          >
            {generating ? "Analizando..." : "Generar con IA"}{" "}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </Card>
    );
  }

  let whenLabel = action.when;
  if (action.when) {
    const d = new Date(action.when);
    if (!isNaN(d.getTime())) {
      whenLabel = format(d, "d 'de' MMMM", { locale: es });
    }
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-accent/10 to-transparent border-accent/30 backdrop-blur-md">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Próxima acción
        </h3>
      </div>
      <p className="text-sm font-medium text-foreground leading-snug">
        {action.title}
      </p>
      {whenLabel && (
        <p className="text-xs text-accent mt-1.5 font-medium">📅 {whenLabel}</p>
      )}
      {action.why && (
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {action.why}
        </p>
      )}
    </Card>
  );
}
