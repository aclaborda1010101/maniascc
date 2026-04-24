import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Phone, Users } from "lucide-react";

interface Contacto {
  id: string;
  nombre: string;
  apellidos: string | null;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  subdivision_id: string | null;
}

export function ContactosAsociadosTable({ operadorId }: { operadorId: string }) {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("contactos")
        .select("id, nombre, apellidos, cargo, email, telefono, subdivision_id")
        .eq("operador_id", operadorId)
        .order("nombre");
      if (!cancel) {
        setContactos((data as Contacto[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [operadorId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-accent" />
          Contactos asociados
          <span className="text-xs font-normal text-white/50">({contactos.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : contactos.length === 0 ? (
          <p className="text-sm text-white/50 py-4 text-center">Sin contactos vinculados a este operador.</p>
        ) : (
          <div className="space-y-1.5">
            {contactos.map((c) => (
              <Link
                key={c.id}
                to={`/contactos/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent shrink-0">
                    {c.nombre?.[0]}{c.apellidos?.[0] || ""}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.nombre} {c.apellidos || ""}
                    </p>
                    {c.cargo && <p className="text-[11px] text-white/50 truncate">{c.cargo}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/55">
                  {c.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {c.email}
                    </span>
                  )}
                  {c.telefono && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {c.telefono}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
