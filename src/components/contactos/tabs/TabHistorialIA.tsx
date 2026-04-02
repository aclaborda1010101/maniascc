import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

const estiloLabels: Record<string, string> = {
  colaborativo: "Colaborativo", competitivo: "Competitivo",
  analitico: "Analítico", expresivo: "Expresivo", evitador: "Evitador",
};

export default function TabHistorialIA({ contacto: c, operador, negociaciones }: {
  contacto: any; operador: any; negociaciones: any[];
}) {
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const context = [
        `Contacto: ${c.nombre} ${c.apellidos || ""}`,
        c.empresa && `Empresa: ${c.empresa}`,
        c.cargo && `Cargo: ${c.cargo}`,
        c.estilo_negociacion && `Estilo negociación: ${estiloLabels[c.estilo_negociacion] || c.estilo_negociacion}`,
        c.notas_perfil && `Notas: ${c.notas_perfil}`,
        operador && `Operador vinculado: ${operador.nombre} (${operador.sector})`,
        `Interacciones: ${c.interaction_count || 0}, WhatsApp msgs: ${c.wa_message_count || 0}, Grabaciones: ${c.plaud_count || 0}`,
        c.sentiment && `Sentiment: ${c.sentiment}`,
      ].filter(Boolean).join("\n");

      const negsCtx = negociaciones.length > 0
        ? "\n\nHistorial de negociaciones:\n" + negociaciones.map(n =>
          `- Estado: ${n.estado}, Resultado: ${n.resultado || "pendiente"}, Prob: ${n.probabilidad_cierre ?? "N/A"}%`
        ).join("\n")
        : "\nSin negociaciones previas.";

      const { data, error } = await supabase.functions.invoke("expert-forge-proxy", {
        body: {
          action: "chat",
          question: "Genera un brief de negociación profesional para la próxima reunión con este contacto. Incluye: resumen del perfil, puntos clave, estrategia recomendada, riesgos, y tácticas sugeridas. Sé específico y accionable.",
          context: `${context}${negsCtx}`,
        },
      });

      if (error) throw error;
      const reply = data?.response || data?.answer || data?.result?.answer || data?.message || "No se pudo generar.";
      setBrief(reply);
    } catch (err: any) {
      toast({ title: "Error al generar brief", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> Brief de Negociación IA
          </CardTitle>
          <Button onClick={generate} disabled={loading} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {loading ? "Generando..." : brief ? "Regenerar" : "Generar Brief"}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : brief ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{brief}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Genera un resumen estratégico para preparar tu próxima reunión con {c.nombre}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
