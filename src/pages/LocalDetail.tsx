import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Trash2, UserPlus, Mail, Phone, Sparkles, MapPin, FileText, Target } from "lucide-react";
import { QuickCreateContactDialog } from "@/components/QuickCreateContactDialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreRing } from "@/components/ScoreRing";
import { cn } from "@/lib/utils";

const PIPELINE_STEPS = [
  { key: "contacto", label: "Contacto" },
  { key: "analisis", label: "Análisis" },
  { key: "matching", label: "Matching" },
  { key: "negociacion", label: "Negociación" },
  { key: "cierre", label: "Cierre" },
];

function pipelineActiveIndex(estado?: string) {
  switch (estado) {
    case "disponible": return 1; // análisis
    case "en_negociacion": return 3;
    case "ocupado": return 4;
    case "reforma": return 1;
    default: return 2; // matching activo por defecto
  }
}

// Score placeholder visual derivado de superficie + renta hasta tener columna real
function placeholderScore(local: any) {
  if (!local) return 0;
  const sup = Number(local.superficie_m2) || 0;
  const renta = Number(local.precio_renta) || 1;
  const ratio = sup / Math.max(renta / 100, 1);
  return Math.max(45, Math.min(98, Math.round(60 + ratio * 2)));
}

export default function LocalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [local, setLocal] = useState<any>(null);
  const [contactos, setContactos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  const fetchContactos = async () => {
    const { data } = await supabase.from("contactos").select("*").eq("activo_id", id);
    setContactos(data || []);
  };

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from("locales").select("*").eq("id", id).single();
      setLocal(data);
      setLoading(false);
    }
    if (id) { fetch(); fetchContactos(); }
  }, [id]);

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    const { error } = await supabase.from("locales").update({
      nombre: local.nombre, direccion: local.direccion, ciudad: local.ciudad,
      codigo_postal: local.codigo_postal, superficie_m2: local.superficie_m2,
      precio_renta: local.precio_renta, estado: local.estado, descripcion: local.descripcion,
      coordenadas_lat: local.coordenadas_lat || null, coordenadas_lng: local.coordenadas_lng || null,
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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }
  if (!local) return <p className="text-muted-foreground">Activo no encontrado.</p>;

  const score = placeholderScore(local);
  const activeIdx = pipelineActiveIndex(local.estado);

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/activos")} className="rounded-2xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Activo</p>
        <div className="flex-1" />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-2xl text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este activo?</AlertDialogTitle>
              <AlertDialogDescription>Esta acción eliminará permanentemente el activo "{local.nombre}".</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* HERO */}
      <div className="card-premium relative overflow-hidden p-6 md:p-8">
        {/* radial gradient backdrop */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(800px circle at 100% 0%, hsl(var(--ava-via) / 0.18), transparent 50%), radial-gradient(600px circle at 0% 100%, hsl(var(--ava-from) / 0.12), transparent 50%)",
          }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
              {local.estado?.replace("_", " ") || "Activo"}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight truncate">
              {local.nombre}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {local.direccion}, {local.ciudad} {local.codigo_postal}
            </p>
          </div>
          <ScoreRing value={score} size={92} label="SCORE" colorScheme="score" />
        </div>

        {/* Mini grid */}
        <div className="relative mt-6 grid grid-cols-3 gap-3 md:gap-6">
          <MiniStat
            label="Superficie"
            value={`${Number(local.superficie_m2 || 0).toLocaleString("es-ES")}`}
            unit="m²"
          />
          <MiniStat
            label="Renta"
            value={`${Number(local.precio_renta || 0).toLocaleString("es-ES")}`}
            unit="€/mes"
          />
          <MiniStat
            label="Estado"
            value={(local.estado || "—").replace("_", " ")}
            unit=""
            capitalize
          />
        </div>
      </div>

      {/* AVA propone */}
      <div
        className="card-premium relative overflow-hidden p-5 md:p-6"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--ava-via) / 0.10) 0%, hsl(var(--ava-from) / 0.05) 50%, hsl(var(--card)) 100%)",
        }}
      >
        <div className="flex items-start gap-4">
          <div className="relative shrink-0 h-11 w-11 rounded-2xl ava-gradient grid place-items-center glow-ring-soft">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">AVA propone</p>
            <p className="text-sm md:text-base text-foreground leading-relaxed">
              {local.descripcion?.slice(0, 220) ||
                `Activo con score ${score}/100. Te recomiendo revisar los matches con operadores compatibles y, si encajan, generar un dossier de presentación profesional.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => navigate(`/matching/${id}`)}
                className="rounded-xl ava-gradient text-white border-0 hover:opacity-95"
              >
                <Target className="h-3.5 w-3.5 mr-1.5" /> Ver matches
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/generador?local=${id}`)}
                className="rounded-xl"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Generar dossier
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline horizontal */}
      <div className="card-premium p-5 md:p-6">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-4">Pipeline</p>
        <div className="flex items-center justify-between gap-1">
          {PIPELINE_STEPS.map((step, i) => {
            const active = i === activeIdx;
            const passed = i < activeIdx;
            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5 min-w-0">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full grid place-items-center text-[11px] font-bold transition-all",
                      active && "ava-gradient text-white glow-ring-soft scale-110",
                      passed && !active && "bg-accent/20 text-accent",
                      !active && !passed && "bg-secondary text-muted-foreground"
                    )}
                  >
                    {passed ? "✓" : i + 1}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] md:text-xs font-medium truncate text-center",
                      active ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-px mx-1 md:mx-2 mt-[-14px]",
                      i < activeIdx ? "bg-accent/40" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs Información / Contactos */}
      <Tabs defaultValue="info">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="info" className="rounded-xl">Información</TabsTrigger>
          <TabsTrigger value="contactos" className="rounded-xl">Contactos</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card className="card-premium border-0 shadow-none">
            <CardHeader><CardTitle className="text-base">Datos del Activo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nombre</Label><Input value={local.nombre} onChange={(e) => setLocal({ ...local, nombre: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Ciudad</Label><Input value={local.ciudad} onChange={(e) => setLocal({ ...local, ciudad: e.target.value })} className="rounded-xl" /></div>
              </div>
              <div className="space-y-2"><Label>Dirección</Label><Input value={local.direccion} onChange={(e) => setLocal({ ...local, direccion: e.target.value })} className="rounded-xl" /></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Código Postal</Label><Input value={local.codigo_postal} onChange={(e) => setLocal({ ...local, codigo_postal: e.target.value })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Superficie (m²)</Label><Input type="number" value={local.superficie_m2} onChange={(e) => setLocal({ ...local, superficie_m2: Number(e.target.value) })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Renta (€/mes)</Label><Input type="number" value={local.precio_renta} onChange={(e) => setLocal({ ...local, precio_renta: Number(e.target.value) })} className="rounded-xl" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={local.estado} onValueChange={(v) => setLocal({ ...local, estado: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disponible">Disponible</SelectItem>
                      <SelectItem value="en_negociacion">En negociación</SelectItem>
                      <SelectItem value="ocupado">Ocupado</SelectItem>
                      <SelectItem value="reforma">En reforma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Latitud</Label><Input type="number" step="any" value={local.coordenadas_lat || ""} onChange={(e) => setLocal({ ...local, coordenadas_lat: e.target.value ? Number(e.target.value) : null })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Longitud</Label><Input type="number" step="any" value={local.coordenadas_lng || ""} onChange={(e) => setLocal({ ...local, coordenadas_lng: e.target.value ? Number(e.target.value) : null })} className="rounded-xl" /></div>
              </div>
              <div className="space-y-2"><Label>Descripción</Label><Textarea value={local.descripcion || ""} onChange={(e) => setLocal({ ...local, descripcion: e.target.value })} rows={3} className="rounded-xl" /></div>
              <Button onClick={handleSave} disabled={saving} className="rounded-xl ava-gradient text-white border-0 hover:opacity-95">
                <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contactos" className="mt-4">
          <Card className="card-premium border-0 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Contactos del Activo</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAddContact(true)} className="rounded-xl">
                <UserPlus className="mr-1 h-3 w-3" /> Añadir contacto
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {contactos.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Sin contactos vinculados a este activo.</p>}
              {contactos.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card-elevated px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full ava-gradient text-xs font-bold text-white">
                      {c.nombre?.[0]}{c.apellidos?.[0] || ""}
                    </div>
                    <div>
                      <Link to={`/contactos/${c.id}`} className="font-medium text-sm hover:underline">{c.nombre} {c.apellidos || ""}</Link>
                      {c.cargo && <p className="text-xs text-muted-foreground">{c.cargo}</p>}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                    {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                    {c.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefono}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <QuickCreateContactDialog open={showAddContact} onOpenChange={setShowAddContact} activoId={id} onCreated={fetchContactos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniStat({
  label, value, unit, capitalize,
}: { label: string; value: string | number; unit: string; capitalize?: boolean }) {
  return (
    <div className="rounded-2xl bg-card-elevated/60 border border-border/40 p-3 md:p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl md:text-2xl font-bold tracking-tight truncate",
          capitalize && "capitalize"
        )}
      >
        {value}
        {unit && <span className="text-xs font-medium text-muted-foreground ml-1">{unit}</span>}
      </p>
    </div>
  );
}
