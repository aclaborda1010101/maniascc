import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Inbox, CheckCircle2, Pencil, XCircle, Loader2, Share2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";

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
  assigned_to: string | null;
  derived_from: string | null;
}

export default function BandejaCorreo() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("item");

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [operadores, setOperadores] = useState<any[]>([]);
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [isAdminOrGestor, setIsAdminOrGestor] = useState(false);
  const [tab, setTab] = useState<"mios" | "todos">("mios");
  const [overrides, setOverrides] = useState<Record<string, { proyecto_id?: string; operador_id?: string; categoria?: string; applyThread?: boolean; rememberAlias?: boolean; aliasText?: string }>>({});

  // Derive dialog
  const [deriveItem, setDeriveItem] = useState<Item | null>(null);
  const [deriveUser, setDeriveUser] = useState<string>("");

  useEffect(() => { init(); }, []);
  const init = async () => {
    if (user) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setIsAdminOrGestor((roles || []).some((r: any) => r.role === "admin" || r.role === "gestor"));
    }
    await loadCatalog();
    await load();
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("email_ingest_queue")
      .select("id,internet_message_id,conversation_id,received_at,from_email,from_name,subject,body_text,has_attachments,classification,assigned_to,derived_from")
      .eq("status", "needs_review")
      .order("received_at", { ascending: false })
      .limit(300);
    setItems((data || []) as Item[]);
    setLoading(false);
  };

  const loadCatalog = async () => {
    const [{ data: p }, { data: o }, { data: pf }] = await Promise.all([
      supabase.from("proyectos").select("id,nombre").eq("merge_status", "activo").order("nombre").limit(500),
      supabase.from("operadores").select("id,nombre").order("nombre").limit(500),
      supabase.from("perfiles").select("user_id,nombre,email").order("nombre"),
    ]);
    setProyectos(p || []);
    setOperadores(o || []);
    setPerfiles(pf || []);
  };

  const proyectoName = (id?: string | null) => id ? (proyectos.find((p) => p.id === id)?.nombre || "—") : "—";
  const operadorName = (id?: string | null) => id ? (operadores.find((o) => o.id === id)?.nombre || "—") : "—";
  const userName = (id?: string | null) => id ? (perfiles.find((p) => p.user_id === id)?.nombre || perfiles.find((p) => p.user_id === id)?.email || "—") : "—";

  const filtered = useMemo(() => {
    if (tab === "mios") return items.filter((i) => i.assigned_to === user?.id);
    return items;
  }, [items, tab, user]);

  const apply = async (item: Item, classification: any, action: "confirm" | "correct" | "discard") => {
    setBusy(item.id);
    try {
      if (action === "discard") {
        await supabase.from("email_ingest_queue").update({ status: "discarded", classification: { ...(item.classification || {}), motivo: "descartado_manual" } }).eq("id", item.id);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        toast({ title: "Descartado" });
        return;
      }

      const ov = overrides[item.id] || {};

      // Learn pattern when correcting
      if (action === "correct" && item.from_email && (classification.proyecto_id || classification.operador_id)) {
        const dom = item.from_email.split("@")[1] || "";
        await supabase.from("ai_learned_patterns").upsert({
          patron_tipo: "email_classification",
          patron_key: item.from_email,
          patron_descripcion: `Remitente ${item.from_email} → ${proyectoName(classification.proyecto_id)}`,
          confianza: 0.85,
          num_observaciones: 1,
          datos_agregados: { proyecto_id: classification.proyecto_id, operador_id: classification.operador_id, categoria: classification.categoria, dominio: dom },
          activo: true,
        }, { onConflict: "patron_tipo,patron_key" });
      }

      // Optional alias creation
      if (action === "correct" && ov.rememberAlias && ov.aliasText && classification.proyecto_id) {
        const alias = ov.aliasText.trim();
        if (alias.length >= 3) {
          const { error: aliasErr } = await supabase.from("project_aliases").insert({ proyecto_id: classification.proyecto_id, alias, created_by: user?.id });
          if (aliasErr && !/duplicate|unique/i.test(aliasErr.message)) console.error(aliasErr);
        }
      }

      const { data, error } = await supabase.functions.invoke("email-classify-journal", {
        body: { item_id: item.id, classification, apply_to_thread: !!ov.applyThread },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const ta = (data as any)?.thread_applied || 0;

      setItems((prev) => prev.filter((i) => i.id !== item.id && (ov.applyThread ? i.conversation_id !== item.conversation_id : true)));
      toast({ title: action === "confirm" ? "Confirmado" : "Aplicado", description: ta ? `+${ta} correos del hilo` : undefined });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(null);
      setEditing(null);
    }
  };

  const submitDerive = async () => {
    if (!deriveItem || !deriveUser) return;
    setBusy(deriveItem.id);
    try {
      const { data, error } = await supabase.functions.invoke("email-classify-journal", {
        body: { action: "derive", item_id: deriveItem.id, new_assignee: deriveUser },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Correo derivado", description: userName(deriveUser) });
      setItems((prev) => prev.map((i) => i.id === deriveItem.id ? { ...i, assigned_to: deriveUser, derived_from: i.assigned_to } : i));
      setDeriveItem(null); setDeriveUser("");
    } catch (e: any) {
      toast({ title: "Error al derivar", description: e?.message || String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const proposals = useMemo(() => filtered.map((it) => {
    const c = it.classification || {};
    const ov = overrides[it.id] || {};
    return {
      item: it,
      sinPropuesta: (c.fuente_clasificacion === "sin_clasificar") || (!c.proyecto_id && !c.operador_id),
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
  }), [filtered, overrides]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Inbox className="h-6 w-6" /> Bandeja de validación
        </h1>
        <p className="text-sm text-muted-foreground">Correos que AVA necesita que valides o clasifiques</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "mios" | "todos")}>
        <TabsList>
          <TabsTrigger value="mios">Míos ({items.filter((i) => i.assigned_to === user?.id).length})</TabsTrigger>
          {isAdminOrGestor && <TabsTrigger value="todos">Todos ({items.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
          ) : proposals.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-chart-2/60" />
              <p className="text-muted-foreground">Sin correos pendientes.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {proposals.map(({ item, merged, sinPropuesta }) => {
                const isEditing = editing === item.id || sinPropuesta;
                const isHighlight = highlightId === item.id;
                const ov = overrides[item.id] || {};
                return (
                  <Card key={item.id} className={`overflow-hidden ${isHighlight ? "ring-2 ring-primary" : ""}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base truncate">{item.subject || "(sin asunto)"}</CardTitle>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.from_name ? `${item.from_name} · ` : ""}{item.from_email} · {new Date(item.received_at).toLocaleString("es-ES")}
                          </p>
                          {item.assigned_to && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Asignado a: <span className="font-medium">{userName(item.assigned_to)}</span>
                              {item.derived_from && <span> · derivado de {userName(item.derived_from)}</span>}
                            </p>
                          )}
                        </div>
                        {sinPropuesta ? (
                          <Badge variant="outline" className="shrink-0 text-xs">Sin clasificar</Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {Math.round((merged.confianza || 0) * 100)}% · {merged.fuente_clasificacion}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {merged.resumen && !sinPropuesta && (
                        <p className="text-sm italic text-muted-foreground">{merged.resumen}</p>
                      )}
                      {item.body_text && (
                        <p className="text-xs text-muted-foreground line-clamp-3">{item.body_text.slice(0, 320)}</p>
                      )}

                      {isEditing ? (
                        <div className="space-y-3 pt-2">
                          <div className="grid gap-3 sm:grid-cols-3">
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
                          <div className="flex flex-wrap items-center gap-4 pt-1">
                            {item.conversation_id && (
                              <label className="flex items-center gap-2 text-xs">
                                <Checkbox checked={!!ov.applyThread} onCheckedChange={(c) => setOverrides((o) => ({ ...o, [item.id]: { ...o[item.id], applyThread: c === true } }))} />
                                Aplicar a todo el hilo
                              </label>
                            )}
                            {merged.proyecto_id && (
                              <label className="flex items-center gap-2 text-xs">
                                <Checkbox checked={!!ov.rememberAlias} onCheckedChange={(c) => setOverrides((o) => ({ ...o, [item.id]: { ...o[item.id], rememberAlias: c === true, aliasText: o[item.id]?.aliasText ?? (item.subject || "").split(/[-:|]/)[0].trim().slice(0, 40) } }))} />
                                Recordar como alias del proyecto
                              </label>
                            )}
                            {ov.rememberAlias && (
                              <Input value={ov.aliasText || ""} onChange={(e) => setOverrides((o) => ({ ...o, [item.id]: { ...o[item.id], aliasText: e.target.value } }))} placeholder="Alias" className="h-8 max-w-xs" />
                            )}
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
                        <Button variant="ghost" size="sm" disabled={busy === item.id} onClick={() => { setDeriveItem(item); setDeriveUser(""); }}>
                          <Share2 className="h-3.5 w-3.5 mr-1" /> No es mío → Derivar
                        </Button>
                        {isEditing && !sinPropuesta ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => { setEditing(null); setOverrides((o) => { const n = { ...o }; delete n[item.id]; return n; }); }}>Cancelar</Button>
                            <Button size="sm" disabled={busy === item.id} onClick={() => apply(item, { ...merged, fuente_clasificacion: "corregido_humano" }, "correct")}>
                              {busy === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />} Aplicar
                            </Button>
                          </>
                        ) : sinPropuesta ? (
                          <>
                            <Button variant="ghost" size="sm" disabled={busy === item.id} onClick={() => apply(item, { ...merged, fuente_clasificacion: "descartado" }, "discard")}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Descartar
                            </Button>
                            <Button size="sm" disabled={busy === item.id || !merged.proyecto_id} onClick={() => apply(item, { ...merged, fuente_clasificacion: "manual_humano" }, "correct")}>
                              {busy === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />} Clasificar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" disabled={busy === item.id} onClick={() => apply(item, { ...merged, fuente_clasificacion: "descartado" }, "discard")}>
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
        </TabsContent>
      </Tabs>

      <Dialog open={!!deriveItem} onOpenChange={(o) => { if (!o) { setDeriveItem(null); setDeriveUser(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Derivar correo</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Elige el responsable real de este correo. Se le notificará y AVA aprenderá el enrutamiento.</p>
            <Select value={deriveUser} onValueChange={setDeriveUser}>
              <SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
              <SelectContent>
                {perfiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.nombre || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeriveItem(null); setDeriveUser(""); }}>Cancelar</Button>
            <Button onClick={submitDerive} disabled={!deriveUser || !!busy}>Derivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
