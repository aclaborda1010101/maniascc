import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, ArrowRight, ListTodo } from "lucide-react";
import { format, isToday, isPast } from "date-fns";
import { es } from "date-fns/locale";

interface PendingTask {
  id: string;
  title: string;
  due_at: string | null;
  priority: number;
  contact_id: string | null;
  contact_name?: string;
}

interface PendingAlert {
  id: string;
  tipo: string;
  severity: string;
  mensaje: string;
  contact_id: string;
  contact_name?: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

export default function PendientesHoyWidget() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [alerts, setAlerts] = useState<PendingAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [tasksRes, alertsRes] = await Promise.all([
        supabase
          .from("contact_tasks")
          .select("id, title, due_at, priority, contact_id")
          .eq("status", "pending")
          .or(`due_at.lte.${todayEnd.toISOString()},due_at.is.null`)
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(8),
        supabase
          .from("contact_alerts")
          .select("id, tipo, severity, mensaje, contact_id")
          .is("dismissed_at", null)
          .in("severity", ["warn", "high"])
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const taskRows = (tasksRes.data || []) as PendingTask[];
      const alertRows = (alertsRes.data || []) as PendingAlert[];

      const contactIds = Array.from(
        new Set(
          [
            ...taskRows.map((t) => t.contact_id),
            ...alertRows.map((a) => a.contact_id),
          ].filter(Boolean) as string[],
        ),
      );

      if (contactIds.length > 0) {
        const { data: contactos } = await supabase
          .from("contactos")
          .select("id, nombre, apellidos")
          .in("id", contactIds);
        const nameMap = new Map(
          (contactos || []).map((c: any) => [
            c.id,
            `${c.nombre || ""} ${c.apellidos || ""}`.trim() || "Contacto",
          ]),
        );
        taskRows.forEach((t) => {
          if (t.contact_id) t.contact_name = nameMap.get(t.contact_id);
        });
        alertRows.forEach((a) => {
          a.contact_name = nameMap.get(a.contact_id);
        });
      }

      if (!mounted) return;
      setTasks(taskRows);
      setAlerts(alertRows);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const total = tasks.length + alerts.length;

  const completeTask = async (id: string) => {
    await supabase
      .from("contact_tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const dismissAlert = async (id: string) => {
    await supabase
      .from("contact_alerts")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm md:text-base flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" />
          Pendientes hoy
          {total > 0 && (
            <Badge className="text-[10px] px-1.5 py-0">{total}</Badge>
          )}
        </CardTitle>
        <Button asChild size="sm" variant="ghost">
          <Link to="/contactos">
            Contactos <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : total === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">Sin pendientes para hoy. Buen trabajo.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-3 rounded-md border p-2.5 text-sm ${
                  SEVERITY_STYLE[a.severity] || ""
                }`}
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-xs md:text-sm capitalize">
                      {a.tipo.replace(/_/g, " ")}
                    </span>
                    {a.contact_name && (
                      <Link
                        to={`/contactos/${a.contact_id}`}
                        className="text-[11px] underline opacity-80 hover:opacity-100"
                      >
                        {a.contact_name}
                      </Link>
                    )}
                  </div>
                  <p className="text-xs opacity-80 truncate">{a.mensaje}</p>
                </div>
                <button
                  onClick={() => dismissAlert(a.id)}
                  className="text-[10px] underline opacity-70 hover:opacity-100"
                >
                  Cerrar
                </button>
              </div>
            ))}

            {tasks.map((t) => {
              const overdue = t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at));
              return (
                <div
                  key={t.id}
                  className={`flex items-start gap-3 rounded-md border p-2.5 text-sm ${
                    overdue ? "border-red-500/30 bg-red-500/5" : ""
                  }`}
                >
                  <button
                    onClick={() => completeTask(t.id)}
                    className="mt-0.5 text-muted-foreground hover:text-emerald-400 transition-colors"
                    title="Marcar como hecha"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-xs md:text-sm">
                        {t.title}
                      </span>
                      {t.priority <= 2 && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-300 border-red-500/30">
                          alta
                        </Badge>
                      )}
                    </div>
                    {t.contact_name && t.contact_id && (
                      <Link
                        to={`/contactos/${t.contact_id}`}
                        className="text-[11px] text-muted-foreground hover:underline"
                      >
                        {t.contact_name}
                      </Link>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-1">
                    {t.due_at
                      ? format(new Date(t.due_at), "d MMM", { locale: es })
                      : "sin fecha"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
