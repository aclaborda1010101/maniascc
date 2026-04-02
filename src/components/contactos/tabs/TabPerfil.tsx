import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Briefcase } from "lucide-react";

const estiloLabels: Record<string, string> = {
  colaborativo: "Colaborativo", competitivo: "Competitivo",
  analitico: "Analítico", expresivo: "Expresivo", evitador: "Evitador",
};

export default function TabPerfil({ contacto: c, operador, negociaciones, onRefresh }: {
  contacto: any; operador: any; negociaciones: any[]; onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Info */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Datos de contacto</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Email" value={c.email} />
          <Row label="Teléfono" value={c.telefono} />
          <Row label="WhatsApp" value={c.whatsapp} />
          <Row label="LinkedIn" value={c.linkedin_url} />
          <Row label="Empresa" value={c.empresa} />
          <Row label="Cargo" value={c.cargo} />
          <Row label="Estilo" value={c.estilo_negociacion ? estiloLabels[c.estilo_negociacion] || c.estilo_negociacion : null} />
          {operador && <Row label="Operador" value={operador.nombre} />}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Notas</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {c.notas_perfil || "Sin notas registradas."}
          </p>
        </CardContent>
      </Card>

      {/* Negotiations */}
      {negociaciones.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Negociaciones ({negociaciones.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {negociaciones.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-lg border p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{n.operadores?.nombre || "Sin operador"}</span>
                  <span className="text-muted-foreground">{n.activos?.nombre || ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{n.estado}</Badge>
                  {n.probabilidad_cierre != null && (
                    <span className="text-muted-foreground">{n.probabilidad_cierre}%</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium truncate ml-4 max-w-[250px] text-right">{value}</span>
    </div>
  );
}
