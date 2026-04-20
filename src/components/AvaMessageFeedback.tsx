import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquarePlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { recordExplicitFeedback } from "@/services/feedbackService";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  messageId: string;
  toolsUsed?: string[];
  className?: string;
}

/**
 * Lightweight feedback bar for AVA chat messages.
 * Captures 👍 / 👎 / corrections to feed the learning loop.
 */
export function AvaMessageFeedback({ messageId, toolsUsed, className }: Props) {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState<"up" | "down" | "correction" | null>(null);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");

  const handleQuick = async (tipo: "thumbs_up" | "thumbs_down") => {
    const r = await recordExplicitFeedback({
      entidadTipo: "ava_message",
      entidadId: messageId,
      feedbackTipo: tipo,
      contexto: { tools_used: toolsUsed || [] },
    });
    if (r.success) {
      setSubmitted(tipo === "thumbs_up" ? "up" : "down");
      toast({ title: "Gracias por tu feedback", description: "Esto entrena a AVA." });
    }
  };

  const handleCorrection = async () => {
    if (!comment.trim()) return;
    const r = await recordExplicitFeedback({
      entidadTipo: "ava_message",
      entidadId: messageId,
      feedbackTipo: "correction",
      correccionSugerida: comment.trim(),
      contexto: { tools_used: toolsUsed || [] },
    });
    if (r.success) {
      setSubmitted("correction");
      setOpen(false);
      setComment("");
      toast({ title: "Corrección registrada", description: "AVA aprenderá de esto." });
    }
  };

  if (submitted) {
    return (
      <div className={cn("flex items-center gap-1 text-[10px] text-muted-foreground", className)}>
        <Check className="h-3 w-3" /> Feedback enviado
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        title="Útil"
        onClick={() => handleQuick("thumbs_up")}
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        title="No útil"
        onClick={() => handleQuick("thumbs_down")}
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            title="Corregir"
          >
            <MessageSquarePlus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <div className="space-y-2">
            <p className="text-xs font-medium">¿Qué debería haber dicho AVA?</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej: faltó mencionar el centro X, el operador Y no encaja porque..."
              rows={3}
              className="text-xs"
            />
            <Button size="sm" className="w-full" onClick={handleCorrection} disabled={!comment.trim()}>
              Enviar corrección
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
