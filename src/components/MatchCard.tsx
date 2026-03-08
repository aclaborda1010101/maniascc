import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useState } from "react";

interface MatchCardProps {
  match: {
    id: string;
    score: number;
    explicacion?: string;
    tags?: string[];
    estado: string;
    operador_id: string;
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

export function MatchCard({ match, index, onUpdate }: MatchCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const colors = scoreColor(match.score);

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
      toast({ title: feedback === "positivo" ? "Match aprobado → Contactado" : "Match descartado" });
      onUpdate?.();
    }
  };

  return (
    <Card
      className={`border-l-4 ${colors.border} animate-in fade-in slide-in-from-bottom-4`}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h3 className="text-lg font-semibold">{(match.operadores as any)?.nombre || "Operador"}</h3>
        <div className={`flex h-14 w-14 items-center justify-center rounded-full ${colors.bg}`}>
          <span className={`text-xl font-bold ${colors.text}`}>{match.score}%</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(match.tags || []).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
        {match.explicacion && (
          <p className="text-sm text-muted-foreground leading-relaxed">{match.explicacion}</p>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {match.estado === "pendiente" ? (
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
          <Badge variant={match.estado === "aprobado" ? "default" : "secondary"} className={match.estado === "aprobado" ? "bg-chart-2/10 text-chart-2" : ""}>
            {match.estado}
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
