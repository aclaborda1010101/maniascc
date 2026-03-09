import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, ExternalLink, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { recordMatchSelection, recordMatchRejection, recordImplicitFeedback } from "@/services/feedbackService";
import { FeedbackWidget } from "@/components/FeedbackWidget";

interface MatchCardProps {
  match: {
    id: string;
    score: number;
    explicacion?: string;
    tags?: string[];
    estado: string;
    operador_id: string;
    feedback_usuario?: string;
    operadores?: { nombre: string } | null;
  };
  index: number;
  onUpdate?: () => void;
}

function scoreColor(score: number) {
  if (score >= 85) return { border: "border-l-chart-2", bg: "bg-chart-2/10", text: "text-chart-2" };
  if (score >= 70) return { border: "border-l-chart-1", bg: "bg-chart-1/10", text: "text-chart-1" };
  if (score >= 50) return { border: "border-l-chart-3", bg: "bg-chart-3/10", text: "text-chart-3" };
  return { border: "border-l-chart-4", bg: "bg-chart-4/10", text: "text-chart-4" };
}

function scoreLabel(score: number) {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Bueno";
  if (score >= 50) return "Regular";
  return "Bajo";
}

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  sugerido: "Sugerido",
  aprobado: "Aprobado",
  contactado: "Contactado",
  descartado: "Descartado",
  exito: "Éxito",
};

const estadoColors: Record<string, string> = {
  pendiente: "",
  sugerido: "bg-chart-1/10 text-chart-1",
  aprobado: "bg-chart-2/10 text-chart-2",
  contactado: "bg-chart-2/10 text-chart-2",
  exito: "bg-chart-2/10 text-chart-2",
  descartado: "bg-chart-4/10 text-chart-4",
};

// Clean tag display
function formatTag(tag: string) {
  return tag
    .replace(/^sector_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MatchCard({ match, index, onUpdate }: MatchCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const colors = scoreColor(match.score);
  const canAct = match.estado === "pendiente" || match.estado === "sugerido";

  // Track implicit view
  useEffect(() => {
    recordImplicitFeedback({
      entidadTipo: 'match',
      entidadId: match.id,
      accion: 'viewed',
      posicionEnLista: index,
    });
  }, [match.id, index]);

  const handleFeedback = async (feedback: "positivo" | "negativo") => {
    setLoading(true);
    const newEstado = feedback === "positivo" ? "contactado" : "descartado";
    const { error } = await supabase
      .from("matches")
      .update({ estado: newEstado, feedback_usuario: feedback } as any)
      .eq("id", match.id);
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Record feedback for learning
      if (feedback === "positivo") {
        recordMatchSelection(match.id, "", match.operador_id, index);
      } else {
        recordMatchRejection(match.id);
      }
      toast({ title: feedback === "positivo" ? "Match aprobado → Contactado" : "Match descartado" });
      onUpdate?.();
    }
  };

  return (
    <Card
      className={`border-l-4 ${colors.border} animate-in fade-in slide-in-from-bottom-4`}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold truncate">{(match.operadores as any)?.nombre || "Operador"}</h3>
            {match.estado === "sugerido" && (
              <Badge variant="secondary" className="bg-chart-1/10 text-chart-1 text-xs shrink-0">
                ⭐ Sugerido
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full ${colors.bg}`}>
            <span className={`text-xl font-bold ${colors.text}`}>{match.score}%</span>
          </div>
          <span className={`text-xs mt-1 ${colors.text}`}>{scoreLabel(match.score)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(match.tags || []).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {formatTag(tag)}
            </Badge>
          ))}
        </div>
        {match.explicacion && (
          <div className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
            <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
            <p>{match.explicacion}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 flex-wrap">
        {canAct ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="text-chart-2 border-chart-2/30 hover:bg-chart-2/10"
              onClick={() => handleFeedback("positivo")}
              disabled={loading}
            >
              <ThumbsUp className="mr-1 h-4 w-4" /> Aprobar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => handleFeedback("negativo")}
              disabled={loading}
            >
              <ThumbsDown className="mr-1 h-4 w-4" /> Descartar
            </Button>
          </>
        ) : (
          <Badge variant="secondary" className={estadoColors[match.estado] || ""}>
            {estadoLabels[match.estado] || match.estado}
          </Badge>
        )}
        <Button size="sm" variant="ghost" asChild className="ml-auto">
          <Link to={`/operadores/${match.operador_id}`}>
            <ExternalLink className="mr-1 h-4 w-4" /> Ver Operador
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
