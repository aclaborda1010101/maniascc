import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Users, Sparkles } from "lucide-react";

interface Contacto {
  id: string;
  nombre: string;
  apellidos: string | null;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  subdivision_id: string | null;
  _inferred?: boolean;
}

export function ContactosAsociadosTable({ operadorId }: { operadorId: string }) {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasInferred, setHasInferred] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      // 1) Vínculo directo
      const { data: direct } = await supabase
        .from("contactos")
        .select("id, nombre, apellidos, cargo, email, telefono, subdivision_id")
        .eq("operador_id", operadorId)
        .order("nombre");

      let resultado = (direct as Contacto[]) || [];

      // 2) Fallback por dominio email del operador (si hay 0 directos)
      if (resultado.length === 0) {
        const { data: op } = await supabase
          .from("operadores")
          .select("contacto_email")
          .eq("id", operadorId)
          .single();
        const dominio = op?.contacto_email?.split("@")[1];
        if (dominio) {
          const { data: porDominio } = await supabase
            .from("contactos")
            .select("id, nombre, apellidos, cargo, email, telefono, subdivision_id")
            .ilike("email", `%@${dominio}`)
            .limit(50);
          resultado = ((porDominio as Contacto[]) || []).map((c) => ({ ...c, _inferred: true }));
        }
      }

      if (!cancel) {
        setContactos(resultado);
        setHasInferred(resultado.some((c) => c._inferred));
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
          "radial-gradient(120% 80% at 0% 0%, hsl(var(--acc-2) / 0.12) 0%, transparent 55%), linear-gradient(180deg, hsl(var(--acc-2) / 0.04) 0%, hsl(200 35% 6% / 0.5) 100%)",
        boxShadow: "0 1px 0 0 hsl(var(--acc-2) / 0.15) inset",
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 backdrop-blur-md">
            <Users className="h-4 w-4 text-accent" />
          </span>
          Contactos asociados
          <span className="text-xs font-normal text-muted-foreground">({contactos.length})</span>
          {hasInferred && (
            <Badge variant="outline" className="ml-auto text-[10px] bg-accent/10 border-accent/30 text-accent">
              <Sparkles className="h-2.5 w-2.5 mr-1" /> inferidos
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : contactos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sin contactos vinculados a este operador.
          </p>
        ) : (
          <div className="space-y-1.5">
            {contactos.map((c) => (
              <Link
                key={c.id}
                to={`/contactos/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/15 bg-background/30 px-3 py-2 hover:bg-background/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent shrink-0">
                    {c.nombre?.[0]}{c.apellidos?.[0] || ""}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      {c.nombre} {c.apellidos || ""}
                      {c._inferred && (
                        <span className="text-[9px] text-accent/70 font-normal">· inferido</span>
                      )}
                    </p>
                    {c.cargo && <p className="text-[11px] text-muted-foreground truncate">{c.cargo}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
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
