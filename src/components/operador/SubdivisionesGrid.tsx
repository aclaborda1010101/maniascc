import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, Network } from "lucide-react";

interface Subdivision {
  id: string;
  nombre: string;
  descripcion: string | null;
  activos: { id: string; nombre: string; direccion: string | null }[];
  contactos: { id: string; nombre: string; apellidos: string | null }[];
}

export function SubdivisionesGrid({ operadorId }: { operadorId: string }) {
  const [subs, setSubs] = useState<Subdivision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      // 1) subdivisiones del operador
      const { data: rawSubs } = await supabase
        .from("operador_subdivisiones")
        .select("id, nombre, descripcion")
        .eq("operador_id", operadorId)
        .order("nombre");

      const subRows = (rawSubs as { id: string; nombre: string; descripcion: string | null }[]) || [];
      if (subRows.length === 0) {
        if (!cancel) { setSubs([]); setLoading(false); }
        return;
      }
      const subIds = subRows.map((s) => s.id);

      // 2) activos por subdivision via subdivision_activos + locales
      const [{ data: rawSA }, { data: rawContactos }] = await Promise.all([
        supabase
          .from("subdivision_activos")
          .select("subdivision_id, activo_id, locales:activo_id (id, nombre, direccion)")
          .in("subdivision_id", subIds),
        supabase
          .from("contactos")
          .select("id, nombre, apellidos, subdivision_id")
          .in("subdivision_id", subIds),
      ]);

      const activosBySub: Record<string, Subdivision["activos"]> = {};
      ((rawSA as any[]) || []).forEach((row) => {
        const arr = (activosBySub[row.subdivision_id] = activosBySub[row.subdivision_id] || []);
        if (row.locales) arr.push(row.locales);
      });

      const contactosBySub: Record<string, Subdivision["contactos"]> = {};
      ((rawContactos as any[]) || []).forEach((c) => {
        const arr = (contactosBySub[c.subdivision_id] = contactosBySub[c.subdivision_id] || []);
        arr.push({ id: c.id, nombre: c.nombre, apellidos: c.apellidos });
      });

      if (!cancel) {
        setSubs(
          subRows.map((s) => ({
            ...s,
            activos: activosBySub[s.id] || [],
            contactos: contactosBySub[s.id] || [],
          })),
        );
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [operadorId]);

  if (loading) return <Skeleton className="h-40 w-full" />;

  if (subs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-white/50">
          Este operador no tiene subdivisiones (presencias en centros) registradas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-white">
          Presencias en centros <span className="text-white/50 font-normal">({subs.length})</span>
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {subs.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{s.nombre}</CardTitle>
              {s.descripcion && <p className="text-xs text-white/50">{s.descripcion}</p>}
            </CardHeader>
            <CardContent className="space-y-2.5">
              {s.activos.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Activos</p>
                  {s.activos.map((a) => (
                    <Link
                      key={a.id}
                      to={`/locales/${a.id}`}
                      className="flex items-start gap-2 text-xs text-accent hover:underline"
                    >
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>
                        {a.nombre}
                        {a.direccion && <span className="text-white/50"> · {a.direccion}</span>}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {s.contactos.length > 0 ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">
                    Contactos asignados
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.contactos.map((c) => (
                      <Link key={c.id} to={`/contactos/${c.id}`}>
                        <Badge
                          variant="outline"
                          className="text-[10px] gap-1 hover:bg-accent/10 cursor-pointer"
                        >
                          <Users className="h-2.5 w-2.5" />
                          {c.nombre} {c.apellidos || ""}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-white/40">Sin contactos asignados.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
