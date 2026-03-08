import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pill, Plus, Search, Trash2, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const riesgoColors: Record<string, { badge: string; icon: typeof AlertTriangle }> = {
  alto: { badge: "bg-destructive/10 text-destructive", icon: AlertTriangle },
  medio: { badge: "bg-chart-3/10 text-chart-3", icon: ShieldAlert },
  bajo: { badge: "bg-chart-2/10 text-chart-2", icon: ShieldCheck },
};

export default function Farmacias() {
  const [farmacias, setFarmacias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroRiesgo, setFiltroRiesgo] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [riesgoForm, setRiesgoForm] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchFarmacias = async () => {
    setLoading(true);
    let q = supabase.from("farmacias").select("*").order("created_at", { ascending: false });
    if (search) q = q.or(`nombre.ilike.%${search}%,codigo_postal.ilike.%${search}%`);
    if (filtroRiesgo !== "todos") q = q.eq("riesgo_desabastecimiento", filtroRiesgo);
    const { data } = await q;
    setFarmacias(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFarmacias(); }, [search, filtroRiesgo]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("farmacias").insert({
      nombre: fd.get("nombre") as string,
      codigo_postal: fd.get("codigo_postal") as string,
      riesgo_desabastecimiento: riesgoForm || null,
      score_riesgo: Number(fd.get("score_riesgo")) || 0,
      created_by: user?.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al crear farmacia", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Farmacia creada correctamente" });
      setDialogOpen(false);
      setRiesgoForm("");
      fetchFarmacias();
    }
  };

  const handleToggleReveal = async (id: string, current: boolean) => {
    const { error } = await supabase.from("farmacias").update({ datos_revelados: !current }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchFarmacias();
  };

  const handleDelete = async (id: string, nombre: string) => {
    const { error } = await supabase.from("farmacias").delete().eq("id", id);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Farmacia "${nombre}" eliminada` });
      fetchFarmacias();
    }
  };

  // Stats
  const riesgoAlto = farmacias.filter(f => f.riesgo_desabastecimiento === "alto").length;
  const riesgoMedio = farmacias.filter(f => f.riesgo_desabastecimiento === "medio").length;
  const revelados = farmacias.filter(f => f.datos_revelados).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Farmacias</h1>
          <p className="text-sm text-muted-foreground">Gestión de traspasos y riesgo de desabastecimiento</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> Nueva Farmacia
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Farmacia</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="f-nombre">Nombre *</Label>
                <Input id="f-nombre" name="nombre" placeholder="Farmacia Central" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-cp">Código Postal *</Label>
                <Input id="f-cp" name="codigo_postal" placeholder="28001" required />
              </div>
              <div className="space-y-2">
                <Label>Riesgo Desabastecimiento</Label>
                <Select value={riesgoForm} onValueChange={setRiesgoForm}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar nivel de riesgo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alto">🔴 Alto</SelectItem>
                    <SelectItem value="medio">🟡 Medio</SelectItem>
                    <SelectItem value="bajo">🟢 Bajo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-score">Score Riesgo (0–100)</Label>
                <Input id="f-score" name="score_riesgo" type="number" min={0} max={100} placeholder="50" />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={submitting}>
                {submitting ? "Creando..." : "Crear Farmacia"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[130px]">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
              <Pill className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{farmacias.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[130px]">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Riesgo Alto</p>
              <p className="text-lg font-bold">{riesgoAlto}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[130px]">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-chart-3/10 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-chart-3" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Riesgo Medio</p>
              <p className="text-lg font-bold">{riesgoMedio}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[130px]">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-chart-2/10 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-chart-2" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Datos revelados</p>
              <p className="text-lg font-bold">{revelados}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o código postal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroRiesgo} onValueChange={setFiltroRiesgo}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Riesgo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los niveles</SelectItem>
                <SelectItem value="alto">🔴 Alto</SelectItem>
                <SelectItem value="medio">🟡 Medio</SelectItem>
                <SelectItem value="bajo">🟢 Bajo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : farmacias.length === 0 ? (
            <div className="py-12 text-center">
              <Pill className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                {search || filtroRiesgo !== "todos" ? "No se encontraron farmacias con esos filtros." : "No hay farmacias registradas. Crea la primera."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>CP</TableHead>
                  <TableHead>Riesgo</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Datos</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {farmacias.map((f) => {
                  const riesgo = riesgoColors[f.riesgo_desabastecimiento];
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nombre}</TableCell>
                      <TableCell>{f.datos_revelados ? f.codigo_postal : "••••"}</TableCell>
                      <TableCell>
                        {f.riesgo_desabastecimiento ? (
                          <Badge variant="secondary" className={riesgo?.badge || ""}>
                            {f.riesgo_desabastecimiento.charAt(0).toUpperCase() + f.riesgo_desabastecimiento.slice(1)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {f.datos_revelados ? (
                          <span className="font-semibold">{f.score_riesgo}</span>
                        ) : (
                          <span className="text-muted-foreground">••</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={f.datos_revelados}
                          onCheckedChange={() => handleToggleReveal(f.id, f.datos_revelados)}
                        />
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar farmacia?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará permanentemente "{f.nombre}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(f.id, f.nombre)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {!loading && farmacias.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{farmacias.length} farmacia{farmacias.length !== 1 ? "s" : ""}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
