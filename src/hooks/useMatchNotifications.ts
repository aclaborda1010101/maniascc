import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/contexts/NotificationContext";

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
 * When the `estado` field changes, shows a toast and adds to notification center.
 */
export function useMatchNotifications() {
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const toastRef = useRef(toast);
  const addNotifRef = useRef(addNotification);
  toastRef.current = toast;
  addNotifRef.current = addNotification;

  useEffect(() => {
    const channel = supabase
      .channel("match-estado-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        async (payload) => {
          const oldEstado = (payload.old as any)?.estado;
          const newEstado = (payload.new as any)?.estado;

          if (!newEstado || oldEstado === newEstado) return;

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

          const oldLabel = estadoLabels[oldEstado] || oldEstado || "—";
          const newLabel = estadoLabels[newEstado] || newEstado;
          const description = `${operadorName}: ${oldLabel} → ${newLabel}`;

          toastRef.current({
            title: "📡 Match actualizado",
            description,
          });

          addNotifRef.current({
            title: "Match actualizado",
            description,
            type: "match_update",
            link: `/operadores/${operadorId}`,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches" },
        async (payload) => {
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

          const score = (payload.new as any)?.score || 0;

          addNotifRef.current({
            title: "Nuevo match generado",
            description: `${operadorName} — Score: ${score}%`,
            type: "match_created",
            link: `/operadores/${operadorId}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
