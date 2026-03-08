import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Pill, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Farmacias() {
  const [farmacias, setFarmacias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchFarmacias = async () => {
    let q = supabase.from("farmacias").select("*").order("created_at", { ascending: false });
    if (search) q = q.ilike("nombre", `%${search}%`);
    const { data } = await q;
    setFarmacias(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFarmacias(); }, [search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("farmacias").insert({
      nombre: fd.get("nombre") as string,
      codigo_postal: fd.get("codigo_postal") as string,
      riesgo_desabastecimiento: fd.get("riesgo") as string || null,
      score_riesgo: Number(fd.get("score_riesgo")) || 0,
      created_by: user?.id,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Farmacia creada" }); setDialogOpen(false); fetchFarmacias(); }
  };

  const handleToggleReveal = async (id: string, current: boolean) => {
    await supabase.from("farmacias").update({ datos_revelados: !current }).eq("id", id);
    fetchFarmacias();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Farmacias</h1>
          <p className="text-muted-foreground">Gestión de traspasos de farmacias</p>
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
              <div className="space-y-2"><Label>Nombre</Label><Input name="nombre" required /></div>
              <div className="space-y-2"><Label>Código Postal</Label><Input name="codigo_postal" required /></div>
              <div className="space-y-2">
                <Label>Riesgo Desabastecimiento</Label>
                <Select name="riesgo">
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="medio">Medio</SelectItem>
                    <SelectItem value="bajo">Bajo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Score Riesgo (0-100)</Label><Input name="score_riesgo" type="number" min={0} max={100} /></div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">Crear</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar farmacias..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : farmacias.length === 0 ? (
            <EmptyState icon={Pill} title="Sin farmacias" description="No hay farmacias registradas. Crea la primera." actionLabel="Nueva Farmacia" onAction={() => setDialogOpen(true)} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>CP</TableHead>
                  <TableHead>Riesgo</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Datos Revelados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {farmacias.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nombre}</TableCell>
                    <TableCell>{f.datos_revelados ? f.codigo_postal : "****"}</TableCell>
                    <TableCell>{f.riesgo_desabastecimiento ? <StatusBadge status={f.riesgo_desabastecimiento} /> : "—"}</TableCell>
                    <TableCell>{f.datos_revelados ? f.score_riesgo : "—"}</TableCell>
                    <TableCell>
                      <Switch checked={f.datos_revelados} onCheckedChange={() => handleToggleReveal(f.id, f.datos_revelados)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
