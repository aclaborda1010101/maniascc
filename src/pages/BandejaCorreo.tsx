import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, CheckCircle2, Pencil, XCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Item {
  id: string;
  internet_message_id: string;
  conversation_id: string | null;
  received_at: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  has_attachments: boolean;
  classification: any;
}

export default function BandejaCorreo() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [operadores, setOperadores] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { proyecto_id?: string; operador_id?: string; categoria?: string }>>({});

  useEffect(() => { load(); loadCatalog(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("email_ingest_queue")
      .select("id,internet_message_id,conversation_id,received_at,from_email,from_name,subject,body_text,has_attachments,classification")
      .eq("status", "needs_review")
      .order("received_at", { ascending: false })
      .limit(200);
    setItems(data || []);
    setLoading(false);
  };

  const loadCatalog = async () => {
    const [{ data: p }, { data: o }] = await Promise.all([
      supabase.from("proyectos").select("id,nombre").order("nombre").limit(500),
      supabase.from("operadores").select("id,nombre").order("nombre").limit(500),
    ]);
    setProyectos(p || []);
    setOperadores(o || []);
  };

  const proyectoName = (id?: string | null) => id ? (proyectos.find((p) => p.id === id)?.nombre || "—") : "—";
  const operadorName = (id?: string | null) => id ? (operadores.find((o) => o.id === id)?.nombre || "—") : "—";

  const apply = async (item: Item, classification: any, action: "confirm" | "correct" | "discard") => {
    setBusy(item.id);
    try {
      if (action === "discard") {
        await supabase.from("email_ingest_queue").update({ status: "discarded", classification: { ...(item.classification || {}), motivo: "descartado_manual" } }).eq("id", item.id);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        toast({ title: "Descartado" });
        return;
      }

      // If corrected → learn pattern
      if (action === "correct" && item.from_email && (classification.proyecto_id || classification.operador_id)) {
        const dom = item.from_email.split("@")[1] || "";
        const key = item.from_email;
        await supabase.from("ai_learned_patterns").upsert({
          patron_tipo: "email_classification",
          patron_key: key,
          patron_descripcion: `Remitente ${key} → ${proyectoName(classification.proyecto_id)}`,
          confianza: 0.85,
          num_observaciones: 1,
          datos_agregados: { proyecto_id: classification.proyecto_id, operador_id: classification.operador_id, categoria: classification.categoria, dominio: dom },
          activo: true,
        }, { onConflict: "patron_tipo,patron_key" });
      }

      const { data, error } = await supabase.functions.invoke("email-classify-journal", {
        body: { item_id: item.id, classification },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast({ title: action === "confirm" ? "Confirmado" : "Corregido y aplicado" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(null);
      setEditing(null);
    }
  };

  const proposals = useMemo(() => items.map((it) => {
    const c = it.classification || {};
    const ov = overrides[it.id] || {};
    return {
      item: it,
      merged: {
        proyecto_id: ov.proyecto_id ?? c.proyecto_id ?? null,
        operador_id: ov.operador_id ?? c.operador_id ?? null,
        categoria: ov.categoria ?? c.categoria ?? "otro",
        contacto_ids: c.contacto_ids || [],
        confianza: c.confianza ?? 0,
        resumen: c.resumen || "",
        fuente_clasificacion: c.fuente_clasificacion || "—",
        es_relevante: true,
      },
    };
  }), [items, overrides]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Inbox className="h-6 w-6" /> Bandeja de validación
        </h1>
        <p className="text-sm text-muted-foreground">Correos que AVA no ha podido clasificar con confianza suficiente</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-chart-2/60" />
          <p className="text-muted-foreground">Sin correos pendientes de validar.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {proposals.map(({ item, merged }) => {
            const isEditing = editing === item.id;
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{item.subject || "(sin asunto)"}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.from_name ? `${item.from_name} · ` : ""}{item.from_email} · {new Date(item.received_at).toLocaleString("es-ES")}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {Math.round((merged.confianza || 0) * 100)}% · {merged.fuente_clasificacion}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {merged.resumen && (
                    <p className="text-sm italic text-muted-foreground">{merged.resumen}</p>
                  )}
                  {item.body_text && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{item.body_text.slice(0, 320)}</p>
                  )}

                  {isEditing ? (
                    <div className="grid gap-3 sm:grid-cols-3 pt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Proyecto</Label>
                        <Select value={merged.proyecto_id || "none"} onValueChange={(v) => setOverrides((o) => ({ ...o, [item.id]: { ...o[item.id], proyecto_id: v === "none" ? undefined : v } }))}>
                          <SelectTrigger><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
                          <SelectContent><SelectItem value="none">Sin proyecto</SelectItem>{proyectos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Operador</Label>
                        <Select value={merged.operador_id || "none"} onValueChange={(v) => setOverrides((o) => ({ ...o, [item.id]: { ...o[item.id], operador_id: v === "none" ? undefined : v } }))}>
                          <SelectTrigger><SelectValue placeholder="Sin operador" /></SelectTrigger>
                          <SelectContent><SelectItem value="none">Sin operador</SelectItem>{operadores.map((o) => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Categoría</Label>
                        <Select value={merged.categoria} onValueChange={(v) => setOverrides((o) => ({ ...o, [item.id]: { ...o[item.id], categoria: v } }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["negociacion","comercial","administracion","tecnico","otro"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="outline">Proyecto: {proyectoName(merged.proyecto_id)}</Badge>
                      <Badge variant="outline">Operador: {operadorName(merged.operador_id)}</Badge>
                      <Badge variant="outline">Categoría: {merged.categoria}</Badge>
                      {item.has_attachments && <Badge variant="secondary">📎 Adjuntos</Badge>}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
                    {isEditing ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => { setEditing(null); setOverrides((o) => { const n = { ...o }; delete n[item.id]; return n; }); }}>Cancelar</Button>
                        <Button size="sm" disabled={busy === item.id} onClick={() => apply(item, { ...merged, fuente_clasificacion: "corregido_humano" }, "correct")}>
                          {busy === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />} Aplicar corrección
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" disabled={busy === item.id} onClick={() => apply(item, { ...merged, fuente_clasificacion: (merged.fuente_clasificacion || "") + ":descartado" }, "discard")}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Descartar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditing(item.id)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Corregir
                        </Button>
                        <Button size="sm" disabled={busy === item.id} onClick={() => apply(item, merged, "confirm")}>
                          {busy === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />} Confirmar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
