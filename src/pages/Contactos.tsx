import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Contact, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const estiloLabels: Record<string, string> = {
  colaborativo: "Colaborativo",
  competitivo: "Competitivo",
  evitativo: "Evitativo",
  acomodaticio: "Acomodaticio",
  comprometido: "Comprometido",
};

const estiloColors: Record<string, string> = {
  colaborativo: "bg-chart-2/10 text-chart-2",
  competitivo: "bg-destructive/10 text-destructive",
  evitativo: "bg-muted text-muted-foreground",
  acomodaticio: "bg-chart-3/10 text-chart-3",
  comprometido: "bg-accent/10 text-accent",
};

export default function Contactos() {
  const [contactos, setContactos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchContactos = async () => {
    setLoading(true);
    let query = supabase.from("perfiles_negociador").select("*").order("creado_en", { ascending: false });
    if (search) {
      query = query.or(`contacto_nombre.ilike.%${search}%,contacto_empresa.ilike.%${search}%,contacto_cargo.ilike.%${search}%`);
    }
    const { data } = await query;
    setContactos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchContactos(); }, [search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("perfiles_negociador").insert({
      contacto_nombre: fd.get("contacto_nombre") as string,
      contacto_empresa: (fd.get("contacto_empresa") as string) || null,
      contacto_cargo: (fd.get("contacto_cargo") as string) || null,
      estilo_primario: (fd.get("estilo_primario") as string) || "colaborativo",
      usuario_id: user?.id,
    });
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
    const { error } = await supabase.from("perfiles_negociador").delete().eq("id", id);
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
          <p className="text-sm text-muted-foreground">Interlocutores y perfiles de negociación</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Contacto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Contacto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="c-nombre">Nombre completo *</Label>
                <Input id="c-nombre" name="contacto_nombre" placeholder="Ana García López" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-empresa">Empresa</Label>
                  <Input id="c-empresa" name="contacto_empresa" placeholder="Grupo Inmobiliario XYZ" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-cargo">Cargo</Label>
                  <Input id="c-cargo" name="contacto_cargo" placeholder="Directora Comercial" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-estilo">Estilo de negociación</Label>
                <Select name="estilo_primario" defaultValue="colaborativo">
                  <SelectTrigger id="c-estilo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaborativo">Colaborativo</SelectItem>
                    <SelectItem value="competitivo">Competitivo</SelectItem>
                    <SelectItem value="comprometido">Comprometido</SelectItem>
                    <SelectItem value="acomodaticio">Acomodaticio</SelectItem>
                    <SelectItem value="evitativo">Evitativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                {submitting ? "Creando..." : "Crear Contacto"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, empresa o cargo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : contactos.length === 0 ? (
            <div className="py-12 text-center">
              <Contact className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">{search ? "No se encontraron contactos." : "No hay contactos aún. Crea el primero."}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Estilo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.contacto_nombre}</TableCell>
                    <TableCell>{c.contacto_empresa || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{c.contacto_cargo || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {c.estilo_primario && (
                        <Badge variant="secondary" className={`text-xs ${estiloColors[c.estilo_primario] || ""}`}>
                          {estiloLabels[c.estilo_primario] || c.estilo_primario}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
                            <AlertDialogDescription>Se eliminará permanentemente a {c.contacto_nombre}.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(c.id, c.contacto_nombre)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
            <p className="mt-3 text-xs text-muted-foreground">{contactos.length} contacto{contactos.length !== 1 ? "s" : ""}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
