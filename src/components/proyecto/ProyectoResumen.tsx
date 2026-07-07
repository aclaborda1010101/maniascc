import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const tipoLabels: Record<string, string> = {
  desarrollo_comercial: "Desarrollo Comercial", venta_activo: "Venta de Activo",
  optimizacion_centros: "Optimización de Centros",
  comercializacion: "Comercialización", negociacion: "Negociación",
  centro_completo: "Centro Completo", auditoria_estrategica: "Auditoría Estratégica",
  desarrollo_suelo: "Desarrollo Suelo", traspaso_adquisicion: "Traspaso/Adquisición",
  farmacia: "Farmacia", otro: "Otro",
};

interface Props {
  proyecto: any;
  activos: any[];
  operadores: any[];
  contactos: any[];
  allLocales: any[];
  onAssignLocal: (localId: string) => void;
}

export function ProyectoResumen({ proyecto, activos, operadores, contactos, allLocales, onAssignLocal }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader className="pb-3"><CardTitle className="text-base">Información del proyecto</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{tipoLabels[proyecto.tipo]}</span></div>
            <div><span className="text-muted-foreground">Creado:</span> {new Date(proyecto.created_at).toLocaleDateString("es-ES")}</div>
            {proyecto.ubicacion && <div><span className="text-muted-foreground">Ubicación:</span> {proyecto.ubicacion}</div>}
            {proyecto.codigo_postal && <div><span className="text-muted-foreground">CP:</span> {proyecto.codigo_postal}</div>}
            {proyecto.presupuesto_estimado && <div><span className="text-muted-foreground">Presupuesto:</span> {Number(proyecto.presupuesto_estimado).toLocaleString("es-ES")} €</div>}
            {proyecto.fecha_inicio && <div><span className="text-muted-foreground">Inicio:</span> {new Date(proyecto.fecha_inicio).toLocaleDateString("es-ES")}</div>}
            {proyecto.fecha_objetivo && <div><span className="text-muted-foreground">Objetivo:</span> {new Date(proyecto.fecha_objetivo).toLocaleDateString("es-ES")}</div>}
          </div>
          {(proyecto.comision_total != null || proyecto.comision_firma != null || proyecto.honorarios_recibidos || proyecto.estatus_comercial) && (
            <div className="pt-2 border-t mt-2">
              <p className="text-muted-foreground text-xs mb-2">Comercial</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {proyecto.estatus_comercial && (
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-muted-foreground">Estatus:</span>
                    <Badge variant="outline" className={
                      proyecto.estatus_comercial === "Firmado" ? "bg-chart-2/10 text-chart-2 border-chart-2/20" :
                      proyecto.estatus_comercial === "Abierto" ? "bg-chart-5/10 text-chart-5 border-chart-5/20" :
                      proyecto.estatus_comercial === "Caído" ? "bg-muted text-muted-foreground" :
                      ""
                    }>{proyecto.estatus_comercial}</Badge>
                  </div>
                )}
                {proyecto.comision_total != null && <div><span className="text-muted-foreground">Comisión total:</span> <span className="font-medium">{Number(proyecto.comision_total).toLocaleString("es-ES")} €</span></div>}
                {proyecto.comision_firma != null && <div><span className="text-muted-foreground">Comisión a firma:</span> {Number(proyecto.comision_firma).toLocaleString("es-ES")} €</div>}
                {proyecto.comision_apertura != null && <div><span className="text-muted-foreground">Comisión apertura:</span> {Number(proyecto.comision_apertura).toLocaleString("es-ES")} €</div>}
                {proyecto.honorarios_recibidos && <div><span className="text-muted-foreground">Honorarios recibidos:</span> {proyecto.honorarios_recibidos}</div>}
                {proyecto.cliente_prop && <div className="col-span-2"><span className="text-muted-foreground">Cliente/Prop.:</span> {proyecto.cliente_prop}</div>}
              </div>
            </div>
          )}
          {proyecto.notas && <div className="pt-2 border-t mt-2"><p className="text-muted-foreground text-xs mb-1">Notas</p><p>{proyecto.notas}</p></div>}
          <div className="pt-2 border-t mt-2">
            <p className="text-muted-foreground text-xs mb-2">Activo asignado (para Matching IA)</p>
            <Select value={proyecto.local_id || "__none"} onValueChange={onAssignLocal}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Sin activo asignado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Sin activo —</SelectItem>
                {allLocales.map((loc: any) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.nombre} — {loc.direccion}, {loc.ciudad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">KPIs del Proyecto</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Activos</span><span className="font-medium">{activos.length}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Operadores</span><span className="font-medium">{operadores.length}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Contactos</span><span className="font-medium">{contactos.length}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
