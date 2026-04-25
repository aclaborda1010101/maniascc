import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";

interface Row {
  id: string;
  rol: string | null;
  proyecto: {
    id: string;
    nombre: string;
    estado: string | null;
    tipo: string | null;
  } | null;
}

const ESTADO_CLS: Record<string, string> = {
  borrador: "bg-muted/40 text-muted-foreground",
  activo: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  pausado: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  completado: "bg-accent/15 text-accent border-accent/30",
  cancelado: "bg-destructive/15 text-destructive border-destructive/30",
};

export function ProyectosCard({ operadorId }: { operadorId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("proyecto_operadores")
        .select("id, rol, proyecto:proyecto_id (id, nombre, estado, tipo)")
        .eq("operador_id", operadorId);
      if (!cancel) {
        setRows(((data as any[]) || []) as Row[]);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [operadorId]);

  return (
    <Card
      className="relative overflow-hidden border-0 backdrop-blur-xl"
      style={{
        backgroundImage:
          "radial-gradient(120% 80% at 0% 100%, hsl(var(--acc-3) / 0.12) 0%, transparent 55%), linear-gradient(180deg, hsl(var(--acc-2) / 0.04) 0%, hsl(200 35% 6% / 0.5) 100%)",
        boxShadow: "0 1px 0 0 hsl(var(--acc-3) / 0.15) inset",
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 backdrop-blur-md">
            <Briefcase className="h-4 w-4 text-accent" />
          </span>
          Oportunidades vinculadas
          <span className="text-xs font-normal text-muted-foreground">({rows.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">Sin oportunidades vinculadas.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => r.proyecto && (
              <Link
                key={r.id}
                to={`/oportunidades/${r.proyecto.id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/15 bg-background/30 px-3 py-2 hover:bg-background/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.proyecto.nombre}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {r.proyecto.tipo && (
                      <span className="text-[10px] text-muted-foreground">{r.proyecto.tipo}</span>
                    )}
                    {r.rol && <Badge variant="outline" className="text-[10px] h-4 border-border/30">{r.rol}</Badge>}
                  </div>
                </div>
                {r.proyecto.estado && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${ESTADO_CLS[r.proyecto.estado] || "bg-muted/40"}`}
                  >
                    {r.proyecto.estado}
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
