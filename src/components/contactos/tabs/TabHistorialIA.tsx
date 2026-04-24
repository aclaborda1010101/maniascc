import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

      const nombreCompleto = `${c.nombre || ""} ${c.apellidos || ""}`.trim();
      if (!nombreCompleto) throw new Error("El contacto no tiene nombre definido");

      const { data, error } = await supabase.functions.invoke("ai-perfil-negociador", {
        body: {
          contacto_nombre: nombreCompleto,
          contacto_empresa: c.empresa || operador?.nombre || undefined,
          contacto_cargo: c.cargo || undefined,
          contexto_deal: `${context}${negsCtx}`,
          notas_previas: c.notas_perfil || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // El edge function devuelve un perfil estructurado: lo formateamos como markdown
      const lines: string[] = [];
      if (data?.estilo_primario) {
        lines.push(`## Perfil del negociador`);
        lines.push(`**Estilo primario:** ${data.estilo_primario}${data.estilo_secundario ? ` · **Secundario:** ${data.estilo_secundario}` : ""}`);
        if (typeof data.probabilidad_cierre === "number") lines.push(`**Probabilidad de cierre:** ${Math.round(data.probabilidad_cierre * (data.probabilidad_cierre <= 1 ? 100 : 1))}%`);
        if (data.formato_preferido) lines.push(`**Formato preferido:** ${data.formato_preferido}`);
      }
      if (data?.recomendacion_apertura) {
        lines.push(`\n## Apertura recomendada\n${data.recomendacion_apertura}`);
      }
      if (Array.isArray(data?.talking_points) && data.talking_points.length) {
        lines.push(`\n## Talking points\n${data.talking_points.map((p: string) => `- ${p}`).join("\n")}`);
      }
      if (Array.isArray(data?.puntos_flexion) && data.puntos_flexion.length) {
        lines.push(`\n## Puntos de flexión\n${data.puntos_flexion.map((p: any) => `- **${p.punto}** (${p.importancia})`).join("\n")}`);
      }
      if (Array.isArray(data?.fortalezas) && data.fortalezas.length) {
        lines.push(`\n## Fortalezas\n${data.fortalezas.map((p: string) => `- ${p}`).join("\n")}`);
      }
      if (Array.isArray(data?.debilidades) && data.debilidades.length) {
        lines.push(`\n## Debilidades\n${data.debilidades.map((p: string) => `- ${p}`).join("\n")}`);
      }
      if (Array.isArray(data?.que_evitar) && data.que_evitar.length) {
        lines.push(`\n## Qué evitar\n${data.que_evitar.map((p: string) => `- ${p}`).join("\n")}`);
      }
      if (data?.historico_resumen) {
        lines.push(`\n## Resumen histórico\n${data.historico_resumen}`);
      }

      const reply = lines.length ? lines.join("\n") : (data?.brief || data?.response || "No se pudo generar.");
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
          <Button onClick={generate} disabled={loading} size="sm" className="bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md">
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{brief}</ReactMarkdown>
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
