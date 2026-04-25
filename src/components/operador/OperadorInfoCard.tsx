import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, User, Building2, Sparkles } from "lucide-react";

interface Props {
  operador: {
    id?: string;
    nombre: string;
    sector?: string | null;
    direccion?: string | null;
    contacto_nombre?: string | null;
    contacto_email?: string | null;
    contacto_telefono?: string | null;
    descripcion?: string | null;
    activo?: boolean;
    matriz_id?: string | null;
  };
}

export function OperadorInfoCard({ operador }: Props) {
  const tieneContacto =
    operador.contacto_nombre || operador.contacto_email || operador.contacto_telefono;

  const [inferido, setInferido] = useState<{ nombre: string; email: string | null; telefono: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (tieneContacto || !operador.id) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("contactos")
        .select("nombre, apellidos, email, telefono")
        .eq("operador_id", operador.id)
        .order("interaction_count", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancel && data) {
        setInferido({
          nombre: `${data.nombre} ${data.apellidos || ""}`.trim(),
          email: data.email,
          telefono: data.telefono,
        });
      }
    })();
    return () => {
      cancel = true;
    };
  }, [operador.id, tieneContacto]);

  return (
    <Card
      className="relative overflow-hidden border-0 backdrop-blur-xl"
      style={{
        backgroundImage:
          "radial-gradient(120% 80% at 100% 0%, hsl(var(--acc-2) / 0.18) 0%, transparent 55%), linear-gradient(180deg, hsl(var(--acc-2) / 0.05) 0%, hsl(200 35% 6% / 0.55) 100%)",
        boxShadow: "0 1px 0 0 hsl(var(--acc-2) / 0.2) inset",
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 backdrop-blur-md">
            <Building2 className="h-4 w-4 text-accent" />
          </span>
          Información del operador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {operador.sector && (
            <Badge variant="outline" className="bg-accent/10 border-accent/30 text-accent">
              {operador.sector}
            </Badge>
          )}
          {!operador.matriz_id && (
            <Badge variant="outline" className="border-border/30">
              Matriz
            </Badge>
          )}
          {operador.activo === false && <Badge variant="secondary">Inactivo</Badge>}
        </div>

        {operador.direccion && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span className="text-foreground/85">{operador.direccion}</span>
          </div>
        )}

        {tieneContacto ? (
          <div className="rounded-xl border border-border/15 bg-background/30 p-3 space-y-2 backdrop-blur-md">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Contacto principal</p>
            {operador.contacto_nombre && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{operador.contacto_nombre}</span>
              </div>
            )}
            {operador.contacto_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <a
                  href={`mailto:${operador.contacto_email}`}
                  className="text-accent hover:underline truncate"
                >
                  {operador.contacto_email}
                </a>
              </div>
            )}
            {operador.contacto_telefono && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`tel:${operador.contacto_telefono}`} className="text-accent hover:underline">
                  {operador.contacto_telefono}
                </a>
              </div>
            )}
          </div>
        ) : inferido ? (
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 space-y-2 backdrop-blur-md">
            <p className="text-[11px] uppercase tracking-wider text-accent flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Contacto inferido (de la red)
            </p>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{inferido.nombre}</span>
            </div>
            {inferido.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`mailto:${inferido.email}`} className="text-accent hover:underline truncate">
                  {inferido.email}
                </a>
              </div>
            )}
            {inferido.telefono && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`tel:${inferido.telefono}`} className="text-accent hover:underline">
                  {inferido.telefono}
                </a>
              </div>
            )}
          </div>
        ) : null}

        {operador.descripcion && (
          <div className="text-sm text-foreground/75 whitespace-pre-wrap">{operador.descripcion}</div>
        )}
      </CardContent>
    </Card>
  );
}
