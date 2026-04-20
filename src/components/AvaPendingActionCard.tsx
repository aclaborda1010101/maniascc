import { useState } from "react";
import { Check, X, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export interface PendingAction {
  table: string;
  action: "insert" | "update";
  data: Record<string, any>;
  match: { id?: string } | null;
  summary: string;
}

interface Props {
  action: PendingAction;
  onResolved?: (result: { confirmed: boolean; success?: boolean; error?: string }) => void;
}

const TABLE_LABEL: Record<string, string> = {
  contactos: "contacto",
  operadores: "operador",
  activos: "activo",
  locales: "local",
  proyectos: "oportunidad",
  negociaciones: "negociación",
  matches: "match",
};

export function AvaPendingActionCard({ action, onResolved }: Props) {
  const [status, setStatus] = useState<"pending" | "executing" | "done" | "cancelled" | "error">("pending");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const label = TABLE_LABEL[action.table] || action.table;
  const verb = action.action === "insert" ? "Crear" : "Actualizar";

  const dataEntries = Object.entries(action.data || {})
    .filter(([k, v]) => v !== null && v !== undefined && v !== "")
    .slice(0, 8);

  const handleConfirm = async () => {
    setStatus("executing");
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("ava-execute-action", {
        body: {
          table: action.table,
          action: action.action,
          data: action.data,
          match: action.match,
        },
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || "Error desconocido";
        setStatus("error");
        setErrorMsg(msg);
        onResolved?.({ confirmed: true, success: false, error: msg });
        return;
      }
      setStatus("done");
      onResolved?.({ confirmed: true, success: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de conexión";
      setStatus("error");
      setErrorMsg(msg);
      onResolved?.({ confirmed: true, success: false, error: msg });
    }
  };

  const handleCancel = () => {
    setStatus("cancelled");
    onResolved?.({ confirmed: false });
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-accent/30 bg-accent/5">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">
            {verb} {label} — Confirmación requerida
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{action.summary}</p>
        </div>
      </div>

      {dataEntries.length > 0 && (
        <div className="mb-2 p-2 rounded bg-background/60 border border-border space-y-0.5">
          {dataEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[10px]">
              <span className="text-muted-foreground min-w-[80px]">{k}:</span>
              <span className="font-mono text-foreground truncate">
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {status === "pending" && (
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs gap-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleConfirm}>
            <Check className="h-3 w-3" /> Confirmar y ejecutar
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleCancel}>
            <X className="h-3 w-3" /> Cancelar
          </Button>
        </div>
      )}

      {status === "executing" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Ejecutando...
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Acción ejecutada correctamente
        </div>
      )}

      {status === "cancelled" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <X className="h-3 w-3" /> Acción cancelada
        </div>
      )}

      {status === "error" && (
        <div className="text-xs text-destructive">
          ❌ {errorMsg || "Error ejecutando la acción"}
        </div>
      )}
    </div>
  );
}
