import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, UserCircle, Trash2, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ImportContactosModal from "@/components/contactos/ImportContactosModal";

const estiloLabels: Record<string, string> = {
  colaborativo: "Colaborativo",
  competitivo: "Competitivo",
  analitico: "Analítico",
  expresivo: "Expresivo",
  evitador: "Evitador",
};

const estiloColors: Record<string, string> = {
  colaborativo: "bg-chart-2/10 text-chart-2",
  competitivo: "bg-destructive/10 text-destructive",
  analitico: "bg-accent/10 text-accent",
  expresivo: "bg-chart-3/10 text-chart-3",
  evitador: "bg-muted text-muted-foreground",
};

export default function Contactos() {
  const navigate = useNavigate();
  const [contactos, setContactos] = useState<any[]>([]);
  const [operadores, setOperadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchContactos = async () => {
    setLoading(true);
    let query = supabase.from("contactos").select("*").order("created_at", { ascending: false });
    if (search) {
      query = query.or(`nombre.ilike.%${search}%,empresa.ilike.%${search}%,cargo.ilike.%${search}%`);
    }
    const { data } = await query;
    setContactos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    supabase
      .from("operadores")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setOperadores(data || []));
  }, []);

  useEffect(() => {
    fetchContactos();
  }, [search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const estilo = fd.get("estilo_negociacion") as string;
    const opId = fd.get("operador_id") as string;
    const { error } = await supabase.from("contactos").insert({
      nombre: fd.get("nombre") as string,
      apellidos: (fd.get("apellidos") as string) || null,
      empresa: (fd.get("empresa") as string) || null,
      cargo: (fd.get("cargo") as string) || null,
      email: (fd.get("email") as string) || null,
      telefono: (fd.get("telefono") as string) || null,
      whatsapp: (fd.get("whatsapp") as string) || null,
      linkedin_url: (fd.get("linkedin_url") as string) || null,
      estilo_negociacion: estilo && estilo !== "none" ? estilo : null,
      operador_id: opId && opId !== "none" ? opId : null,
      notas_perfil: (fd.get("notas_perfil") as string) || null,
      creado_por: user?.id,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al crear contacto", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contacto creado correctamente" });
      setDialogOpen(false);
      fetchContactos();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from("contactos").delete().eq("id", id);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${name} eliminado` });
      fetchContactos();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contactos</h1>
          <p className="text-sm text-muted-foreground">Base de datos global de personas externas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="mr-2 h-4 w-4" /> Nuevo Contacto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Contacto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-nombre">Nombre *</Label>
                    <Input id="c-nombre" name="nombre" placeholder="Ana" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-apellidos">Apellidos</Label>
                    <Input id="c-apellidos" name="apellidos" placeholder="García López" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-empresa">Empresa</Label>
                    <Input id="c-empresa" name="empresa" placeholder="Grupo XYZ" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-cargo">Cargo</Label>
                    <Input id="c-cargo" name="cargo" placeholder="Dir. Comercial" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-email">Email</Label>
                    <Input id="c-email" name="email" type="email" placeholder="ana@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-tel">Teléfono</Label>
                    <Input id="c-tel" name="telefono" placeholder="+34 600 000 000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-whatsapp">WhatsApp</Label>
                    <Input id="c-whatsapp" name="whatsapp" placeholder="+34 600 000 000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-linkedin">LinkedIn</Label>
                    <Input id="c-linkedin" name="linkedin_url" placeholder="https://linkedin.com/in/..." />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-operador">Operador vinculado</Label>
                  <Select name="operador_id" defaultValue="none">
                    <SelectTrigger id="c-operador">
                      <SelectValue placeholder="Sin operador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin operador</SelectItem>
                      {operadores.map((op) => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-estilo">Estilo de negociación</Label>
                  <Select name="estilo_negociacion" defaultValue="none">
                    <SelectTrigger id="c-estilo">
                      <SelectValue placeholder="Sin definir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin definir</SelectItem>
                      <SelectItem value="colaborativo">Colaborativo</SelectItem>
                      <SelectItem value="competitivo">Competitivo</SelectItem>
                      <SelectItem value="analitico">Analítico</SelectItem>
                      <SelectItem value="expresivo">Expresivo</SelectItem>
                      <SelectItem value="evitador">Evitador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-notas">Notas</Label>
                  <Textarea id="c-notas" name="notas_perfil" placeholder="Observaciones sobre este contacto..." rows={2} />
                </div>
                <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                  {submitting ? "Creando..." : "Crear Contacto"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <ImportContactosModal open={importOpen} onOpenChange={setImportOpen} onImported={fetchContactos} />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, empresa o cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : contactos.length === 0 ? (
            <div className="py-12 text-center">
              <UserCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                {search ? "No se encontraron contactos." : "No hay contactos aún. Crea el primero."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estilo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactos.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/contactos/${c.id}`)}
                  >
                    <TableCell className="font-medium">
                      {c.nombre} {c.apellidos || ""}
                    </TableCell>
                    <TableCell>
                      {c.empresa || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {c.cargo || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.email || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {c.estilo_negociacion && (
                        <Badge
                          variant="secondary"
                          className={`text-xs ${estiloColors[c.estilo_negociacion] || ""}`}
                        >
                          {estiloLabels[c.estilo_negociacion] || c.estilo_negociacion}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará permanentemente a {c.nombre}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(c.id, c.nombre)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && contactos.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {contactos.length} contacto{contactos.length !== 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
