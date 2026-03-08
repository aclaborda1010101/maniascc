import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  sugerido: "Sugerido",
  aprobado: "Aprobado",
  contactado: "Contactado",
  descartado: "Descartado",
  exito: "Éxito",
};

/**
 * Subscribes to real-time UPDATE events on the matches table.
 * When the `estado` field changes, shows a toast notification.
 */
export function useMatchNotifications() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    const channel = supabase
      .channel("match-estado-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        async (payload) => {
          const oldEstado = (payload.old as any)?.estado;
          const newEstado = (payload.new as any)?.estado;

          // Only notify when estado actually changed
          if (!newEstado || oldEstado === newEstado) return;

          // Try to resolve operator name for a richer notification
          let operadorName = "Operador";
          const operadorId = (payload.new as any)?.operador_id;
          if (operadorId) {
            const { data } = await supabase
              .from("operadores")
              .select("nombre")
              .eq("id", operadorId)
              .single();
            if (data?.nombre) operadorName = data.nombre;
          }

          const oldLabel = estadoLabels[oldEstado] || oldEstado;
          const newLabel = estadoLabels[newEstado] || newEstado;

          toastRef.current({
            title: "📡 Match actualizado",
            description: `${operadorName}: ${oldLabel} → ${newLabel}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
