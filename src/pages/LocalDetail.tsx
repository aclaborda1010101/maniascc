import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Sparkles, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const estadoLabels: Record<string, string> = {
  disponible: "Disponible",
  en_negociacion: "En negociación",
  ocupado: "Ocupado",
  reforma: "En reforma",
};

export default function LocalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [local, setLocal] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetch() {
      const [localRes, matchesRes] = await Promise.all([
        supabase.from("locales").select("*").eq("id", id).single(),
        supabase.from("matches").select("*, operadores(nombre)").eq("local_id", id).order("score", { ascending: false }),
      ]);
      setLocal(localRes.data);
      setMatches(matchesRes.data || []);
      setLoading(false);
    }
    if (id) fetch();
  }, [id]);

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    const { error } = await supabase.from("locales").update({
      nombre: local.nombre,
      direccion: local.direccion,
      ciudad: local.ciudad,
      codigo_postal: local.codigo_postal,
      superficie_m2: local.superficie_m2,
      precio_renta: local.precio_renta,
      estado: local.estado,
      descripcion: local.descripcion,
      coordenadas_lat: local.coordenadas_lat || null,
      coordenadas_lng: local.coordenadas_lng || null,
    }).eq("id", id);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Activo actualizado correctamente" });
  };

  const handleDelete = async () => {
    await supabase.from("locales").delete().eq("id", id);
    toast({ title: "Activo eliminado" });
    navigate("/activos");
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!local) return <p className="text-muted-foreground">Local no encontrado.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/locales")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{local.nombre}</h1>
          <p className="text-sm text-muted-foreground">{local.direccion}, {local.ciudad} {local.codigo_postal}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este local?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente el local "{local.nombre}" y todos sus matches asociados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Datos del Local</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={local.nombre} onChange={(e) => setLocal({ ...local, nombre: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input value={local.ciudad} onChange={(e) => setLocal({ ...local, ciudad: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={local.direccion} onChange={(e) => setLocal({ ...local, direccion: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Código Postal</Label>
                <Input value={local.codigo_postal} onChange={(e) => setLocal({ ...local, codigo_postal: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Superficie (m²)</Label>
                <Input type="number" value={local.superficie_m2} onChange={(e) => setLocal({ ...local, superficie_m2: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Renta (€/mes)</Label>
                <Input type="number" value={local.precio_renta} onChange={(e) => setLocal({ ...local, precio_renta: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={local.estado} onValueChange={(v) => setLocal({ ...local, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponible">Disponible</SelectItem>
                    <SelectItem value="en_negociacion">En negociación</SelectItem>
                    <SelectItem value="ocupado">Ocupado</SelectItem>
                    <SelectItem value="reforma">En reforma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Latitud</Label>
                <Input type="number" step="any" value={local.coordenadas_lat || ""} onChange={(e) => setLocal({ ...local, coordenadas_lat: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="space-y-2">
                <Label>Longitud</Label>
                <Input type="number" step="any" value={local.coordenadas_lng || ""} onChange={(e) => setLocal({ ...local, coordenadas_lng: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={local.descripcion || ""} onChange={(e) => setLocal({ ...local, descripcion: e.target.value })} rows={3} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" /> Acciones IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to={`/matching/${id}`}>
                  <Sparkles className="mr-2 h-4 w-4" /> Generar Matches IA
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                El algoritmo buscará los operadores más compatibles según superficie, renta y sector.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Estadísticas</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Matches generados</span><span className="font-semibold">{matches.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mejor score</span><span className="font-semibold">{matches.length > 0 ? `${matches[0].score}%` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Último match</span><span className="font-semibold">{matches.length > 0 ? new Date(matches[0].created_at).toLocaleDateString("es-ES") : "—"}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Matches</CardTitle>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Sin matches para este local. Usa "Generar Matches IA" para empezar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Explicación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link to={`/operadores/${m.operador_id}`} className="font-medium text-accent hover:underline">
                        {(m.operadores as any)?.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-sm font-semibold text-accent">{m.score}%</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(m.tags || []).map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{m.estado?.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{m.explicacion}</TableCell>
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
