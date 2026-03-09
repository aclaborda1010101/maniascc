import { useState } from "react";
import { ThumbsUp, ThumbsDown, Star, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { recordExplicitFeedback, type EntityType, type FeedbackType } from "@/services/feedbackService";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  entidadTipo: EntityType;
  entidadId: string;
  compact?: boolean;
  className?: string;
}

export function FeedbackWidget({ entidadTipo, entidadId, compact = false, className }: Props) {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState<FeedbackType | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);

  const handleFeedback = async (tipo: FeedbackType, ratingVal?: number) => {
    const result = await recordExplicitFeedback({
      entidadTipo,
      entidadId,
      feedbackTipo: tipo,
      rating: ratingVal,
      comentario: comment || undefined,
    });

    if (result.success) {
      setSubmitted(tipo);
      toast({ title: "¡Gracias por tu feedback!", description: "Esto ayuda a mejorar la IA." });
    }
  };

  const handleSubmitComment = async () => {
    await handleFeedback("correction", rating || undefined);
    setShowComment(false);
    setComment("");
  };

  if (submitted) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <span>✓ Feedback enviado</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFeedback("thumbs_up")}>
          <ThumbsUp className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFeedback("thumbs_down")}>
          <ThumbsDown className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">¿Te fue útil?</span>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleFeedback("thumbs_up")}>
        <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Sí
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleFeedback("thumbs_down")}>
        <ThumbsDown className="h-3.5 w-3.5 mr-1" /> No
      </Button>
      
      {/* Star rating */}
      <div className="flex items-center gap-0.5 ml-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => { setRating(s); handleFeedback("star_rating", s); }}
            className="p-0.5 hover:scale-110 transition-transform">
            <Star className={cn("h-3.5 w-3.5", s <= rating ? "fill-primary text-primary" : "text-muted-foreground/40")} />
          </button>
        ))}
      </div>

      <Popover open={showComment} onOpenChange={setShowComment}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-2">
            <p className="text-xs font-medium">¿Cómo podemos mejorar?</p>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tu corrección o sugerencia..." rows={3} className="text-xs" />
            <Button size="sm" className="w-full" onClick={handleSubmitComment} disabled={!comment.trim()}>
              Enviar corrección
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
