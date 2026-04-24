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
  borrador: "bg-muted text-muted-foreground",
  activo: "bg-chart-2/15 text-chart-2",
  pausado: "bg-chart-3/15 text-chart-3",
  completado: "bg-accent/15 text-accent",
  cancelado: "bg-destructive/15 text-destructive",
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-accent" />
          Oportunidades vinculadas
          <span className="text-xs font-normal text-white/50">({rows.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-white/50 py-3 text-center">Sin oportunidades vinculadas.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => r.proyecto && (
              <Link
                key={r.id}
                to={`/oportunidades/${r.proyecto.id}`}
                className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 hover:bg-white/[0.06] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.proyecto.nombre}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {r.proyecto.tipo && (
                      <span className="text-[10px] text-white/45">{r.proyecto.tipo}</span>
                    )}
                    {r.rol && <Badge variant="outline" className="text-[10px] h-4">{r.rol}</Badge>}
                  </div>
                </div>
                {r.proyecto.estado && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${ESTADO_CLS[r.proyecto.estado] || "bg-muted"}`}
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
