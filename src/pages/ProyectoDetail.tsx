import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, MapPin, Users, FileText, Sparkles, MessageSquare,
  Calendar, Plus, Trash2, Contact,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const estadoLabels: Record<string, string> = {
  borrador: "Borrador", activo: "Activo", en_pausa: "En pausa",
  cerrado_exito: "Cerrado ✓", cerrado_sin_exito: "Cerrado ✗",
};
const estadoColors: Record<string, string> = {
  borrador: "bg-muted text-muted-foreground", activo: "bg-chart-2/10 text-chart-2",
  en_pausa: "bg-chart-3/10 text-chart-3", cerrado_exito: "bg-accent/10 text-accent",
  cerrado_sin_exito: "bg-destructive/10 text-destructive",
};
const tipoLabels: Record<string, string> = {
  comercializacion: "Comercialización", negociacion: "Negociación",
  centro_completo: "Centro Completo", otro: "Otro",
};

export default function ProyectoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [proyecto, setProyecto] = useState<any>(null);
  const [operadores, setOperadores] = useState<any[]>([]);
  const [contactos, setContactos] = useState<any[]>([]);
  const [allOperadores, setAllOperadores] = useState<any[]>([]);
  const [allContactos, setAllContactos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpDialog, setAddOpDialog] = useState(false);
  const [addCtDialog, setAddCtDialog] = useState(false);

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);
    const [proyRes, opsRes, ctsRes] = await Promise.all([
      supabase.from("proyectos").select("*, locales(id, nombre, ciudad, direccion, superficie_m2, precio_renta, estado)").eq("id", id).single(),
      supabase.from("proyecto_operadores").select("*, operadores(id, nombre, sector, activo)").eq("proyecto_id", id),
      supabase.from("proyecto_contactos").select("*, perfiles_negociador(id, contacto_nombre, contacto_empresa, contacto_cargo)").eq("proyecto_id", id),
    ]);
    setProyecto(proyRes.data);
    setOperadores(opsRes.data || []);
    setContactos(ctsRes.data || []);
    setLoading(false);
  };

  const fetchAvailable = async () => {
    const [opRes, ctRes] = await Promise.all([
      supabase.from("operadores").select("id, nombre, sector").eq("activo", true).order("nombre"),
      supabase.from("perfiles_negociador").select("id, contacto_nombre, contacto_empresa").order("contacto_nombre"),
    ]);
    setAllOperadores(opRes.data || []);
    setAllContactos(ctRes.data || []);
  };

  useEffect(() => { fetchAll(); fetchAvailable(); }, [id]);

  const updateEstado = async (estado: string) => {
    await supabase.from("proyectos").update({ estado: estado as any }).eq("id", id!);
    setProyecto((p: any) => ({ ...p, estado }));
    toast({ title: `Estado actualizado a ${estadoLabels[estado]}` });
  };

  const addOperador = async (opId: string) => {
    const { error } = await supabase.from("proyecto_operadores").insert({ proyecto_id: id!, operador_id: opId });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAddOpDialog(false);
      fetchAll();
    }
  };

  const removeOperador = async (rowId: string) => {
    await supabase.from("proyecto_operadores").delete().eq("id", rowId);
    fetchAll();
  };

  const addContacto = async (ctId: string) => {
    const { error } = await supabase.from("proyecto_contactos").insert({ proyecto_id: id!, contacto_id: ctId });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAddCtDialog(false);
      fetchAll();
    }
  };

  const removeContacto = async (rowId: string) => {
    await supabase.from("proyecto_contactos").delete().eq("id", rowId);
    fetchAll();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!proyecto) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/proyectos")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <p className="text-muted-foreground">Proyecto no encontrado.</p>
      </div>
    );
  }

  const local = proyecto.locales as any;
  const linkedOpIds = new Set(operadores.map((o) => (o.operadores as any)?.id));
  const linkedCtIds = new Set(contactos.map((c) => (c.perfiles_negociador as any)?.id));
  const availableOps = allOperadores.filter((o) => !linkedOpIds.has(o.id));
  const availableCts = allContactos.filter((c) => !linkedCtIds.has(c.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/proyectos")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{proyecto.nombre}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{tipoLabels[proyecto.tipo]}</Badge>
                <Badge variant="secondary" className={`text-xs ${estadoColors[proyecto.estado]}`}>
                  {estadoLabels[proyecto.estado]}
                </Badge>
                {proyecto.fecha_objetivo && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Objetivo: {new Date(proyecto.fecha_objetivo).toLocaleDateString("es-ES")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Select value={proyecto.estado} onValueChange={updateEstado}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="en_pausa">En pausa</SelectItem>
            <SelectItem value="cerrado_exito">Cerrado ✓</SelectItem>
            <SelectItem value="cerrado_sin_exito">Cerrado ✗</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {proyecto.descripcion && (
        <p className="text-sm text-muted-foreground max-w-2xl">{proyecto.descripcion}</p>
      )}

      {/* Tabs */}
      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="operadores" className="gap-1">
            <Users className="h-3.5 w-3.5" /> Operadores
            {operadores.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{operadores.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="contactos" className="gap-1">
            <Contact className="h-3.5 w-3.5" /> Contactos
            {contactos.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{contactos.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="herramientas" className="gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Herramientas IA
          </TabsTrigger>
        </TabsList>

        {/* RESUMEN */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Local card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4 text-accent" /> Local Vinculado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {local ? (
                  <Link to={`/locales/${local.id}`} className="block rounded-md border p-3 hover:bg-muted/50 transition-colors">
                    <p className="font-medium text-accent hover:underline">{local.nombre}</p>
                    <p className="text-sm text-muted-foreground">{local.direccion}, {local.ciudad}</p>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{Number(local.superficie_m2).toLocaleString("es-ES")} m²</span>
                      <span>{Number(local.precio_renta).toLocaleString("es-ES")} €/mes</span>
                    </div>
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sin local vinculado</p>
                )}
              </CardContent>
            </Card>

            {/* Info card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium">{tipoLabels[proyecto.tipo]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creado</span>
                  <span>{new Date(proyecto.created_at).toLocaleDateString("es-ES")}</span>
                </div>
                {proyecto.fecha_inicio && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Inicio</span>
                    <span>{new Date(proyecto.fecha_inicio).toLocaleDateString("es-ES")}</span>
                  </div>
                )}
                {proyecto.fecha_objetivo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Objetivo</span>
                    <span>{new Date(proyecto.fecha_objetivo).toLocaleDateString("es-ES")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Operadores</span>
                  <span>{operadores.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contactos</span>
                  <span>{contactos.length}</span>
                </div>
                {proyecto.notas && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground text-xs mb-1">Notas</p>
                    <p>{proyecto.notas}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* OPERADORES */}
        <TabsContent value="operadores" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{operadores.length} operador{operadores.length !== 1 ? "es" : ""} vinculado{operadores.length !== 1 ? "s" : ""}</p>
            <Dialog open={addOpDialog} onOpenChange={setAddOpDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" /> Añadir</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Añadir Operador</DialogTitle></DialogHeader>
                {availableOps.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No hay operadores disponibles para añadir.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableOps.map((op) => (
                      <button
                        key={op.id}
                        onClick={() => addOperador(op.id)}
                        className="w-full flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div>
                          <p className="font-medium text-sm">{op.nombre}</p>
                          <p className="text-xs text-muted-foreground">{op.sector}</p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
          {operadores.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">No hay operadores vinculados a este proyecto.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {operadores.map((row) => {
                const op = row.operadores as any;
                return (
                  <div key={row.id} className="flex items-center justify-between rounded-md border p-3">
                    <Link to={`/operadores/${op?.id}`} className="flex-1 min-w-0">
                      <p className="font-medium text-accent hover:underline">{op?.nombre}</p>
                      <p className="text-xs text-muted-foreground">{op?.sector} · Rol: {row.rol}</p>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => removeOperador(row.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* CONTACTOS */}
        <TabsContent value="contactos" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{contactos.length} contacto{contactos.length !== 1 ? "s" : ""}</p>
            <Dialog open={addCtDialog} onOpenChange={setAddCtDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" /> Añadir</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Añadir Contacto</DialogTitle></DialogHeader>
                {availableCts.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">No hay contactos disponibles.</p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/contactos">Crear contacto</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableCts.map((ct) => (
                      <button
                        key={ct.id}
                        onClick={() => addContacto(ct.id)}
                        className="w-full flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div>
                          <p className="font-medium text-sm">{ct.contacto_nombre}</p>
                          <p className="text-xs text-muted-foreground">{ct.contacto_empresa || "Sin empresa"}</p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
          {contactos.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Contact className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">No hay contactos vinculados a este proyecto.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {contactos.map((row) => {
                const ct = row.perfiles_negociador as any;
                return (
                  <div key={row.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{ct?.contacto_nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {ct?.contacto_cargo && `${ct.contacto_cargo} · `}{ct?.contacto_empresa || ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeContacto(row.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* HERRAMIENTAS IA */}
        <TabsContent value="herramientas" className="space-y-4">
          <p className="text-sm text-muted-foreground">Accede a las herramientas de inteligencia artificial en el contexto de este proyecto.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {local && (
              <Link to={`/matching/${local.id}`}>
                <Card className="hover:border-accent/50 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="flex items-center gap-3 py-5">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">Matching IA</p>
                      <p className="text-xs text-muted-foreground">Generar matches para el local vinculado</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
            <Link to="/localizacion-analisis">
              <Card className="hover:border-accent/50 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="flex items-center gap-3 py-5">
                  <div className="h-10 w-10 rounded-full bg-chart-2/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-chart-2" />
                  </div>
                  <div>
                    <p className="font-medium">Análisis de Localización</p>
                    <p className="text-xs text-muted-foreground">Evaluar viabilidad de la ubicación</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/validacion-dossier">
              <Card className="hover:border-accent/50 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="flex items-center gap-3 py-5">
                  <div className="h-10 w-10 rounded-full bg-chart-3/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-chart-3" />
                  </div>
                  <div>
                    <p className="font-medium">Validar Dossier</p>
                    <p className="text-xs text-muted-foreground">Verificar retornos declarados vs mercado</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/negociacion-briefing">
              <Card className="hover:border-accent/50 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="flex items-center gap-3 py-5">
                  <div className="h-10 w-10 rounded-full bg-chart-5/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-chart-5" />
                  </div>
                  <div>
                    <p className="font-medium">Briefing de Negociación</p>
                    <p className="text-xs text-muted-foreground">Perfilar interlocutor y tácticas</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
