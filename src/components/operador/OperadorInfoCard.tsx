import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, User, Building2 } from "lucide-react";

interface Props {
  operador: {
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
  const tieneContacto = operador.contacto_nombre || operador.contacto_email || operador.contacto_telefono;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-accent" />
          Información del operador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {operador.sector && <Badge variant="outline" className="bg-accent/10 border-accent/30">{operador.sector}</Badge>}
          {!operador.matriz_id && <Badge variant="outline">Matriz</Badge>}
          {operador.activo === false && <Badge variant="secondary">Inactivo</Badge>}
        </div>

        {operador.direccion && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 text-white/50 shrink-0" />
            <span className="text-white/80">{operador.direccion}</span>
          </div>
        )}

        {tieneContacto && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-white/50">Contacto principal</p>
            {operador.contacto_nombre && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-white/50" />
                <span>{operador.contacto_nombre}</span>
              </div>
            )}
            {operador.contacto_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-white/50" />
                <a href={`mailto:${operador.contacto_email}`} className="text-accent hover:underline truncate">
                  {operador.contacto_email}
                </a>
              </div>
            )}
            {operador.contacto_telefono && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-white/50" />
                <a href={`tel:${operador.contacto_telefono}`} className="text-accent hover:underline">
                  {operador.contacto_telefono}
                </a>
              </div>
            )}
          </div>
        )}

        {operador.descripcion && (
          <div className="text-sm text-white/70 whitespace-pre-wrap">{operador.descripcion}</div>
        )}
      </CardContent>
    </Card>
  );
}
