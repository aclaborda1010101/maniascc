import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Clock, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export interface ContactTask {
  id: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  priority: number;
  status: string;
  source: string;
}

interface Props {
  tasks: ContactTask[];
  onToggle: (id: string, done: boolean) => void;
  onAdd: () => void;
}

const priorityColor: Record<number, string> = {
  1: "text-muted-foreground",
  2: "text-muted-foreground",
  3: "text-foreground",
  4: "text-amber-400",
  5: "text-rose-400",
};

export function TareasPendientesCard({ tasks, onToggle, onAdd }: Props) {
  const pending = tasks.filter((t) => t.status === "pending");

  return (
    <Card className="p-4 bg-card/40 backdrop-blur-md border-border/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tareas pendientes
          </h3>
          {pending.length > 0 && (
            <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded">
              {pending.length}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onAdd} className="h-6 px-2">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {pending.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Sin tareas pendientes.
        </p>
      ) : (
        <ul className="space-y-2 max-h-[180px] overflow-y-auto">
          {pending.slice(0, 6).map((t) => {
            const overdue =
              t.due_at && new Date(t.due_at).getTime() < Date.now();
            return (
              <li key={t.id} className="flex items-start gap-2 text-xs">
                <Checkbox
                  checked={false}
                  onCheckedChange={(v) => onToggle(t.id, !!v)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={`leading-snug ${priorityColor[t.priority] || ""}`}>
                    {t.title}
                  </p>
                  {t.due_at && (
                    <p
                      className={`text-[10px] mt-0.5 ${
                        overdue ? "text-rose-400" : "text-muted-foreground"
                      }`}
                    >
                      {overdue ? "⚠ Vencida — " : "📅 "}
                      {formatDistanceToNow(new Date(t.due_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </p>
                  )}
                </div>
                {t.source !== "manual" && (
                  <span className="text-[9px] text-accent/60 uppercase tracking-wide">
                    IA
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
