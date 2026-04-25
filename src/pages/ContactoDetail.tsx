import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { EntityNarrativesPanel } from "@/components/EntityNarrativesPanel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  Linkedin,
  Building2,
  Briefcase,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Brain,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

import { parsePerfilIA, isPerfilEmpty } from "@/types/perfilIa";
import { perfilIaMock } from "@/mocks/perfilIaMock";
import { PerfilIaSection } from "@/components/contacto/PerfilIaSection";
import { LineaDeVida } from "@/components/contacto/LineaDeVida";
import { EvolucionReciente } from "@/components/contacto/EvolucionReciente";
import { DatosClaveChips } from "@/components/contacto/DatosClaveChips";
import { MetricasComunicacion } from "@/components/contacto/MetricasComunicacion";
import { LineaDelTiempo } from "@/components/contacto/LineaDelTiempo";
import { PerfilProfesionalCard } from "@/components/contacto/PerfilProfesionalCard";
import { PerfilPersonalCard } from "@/components/contacto/PerfilPersonalCard";

// Vista 360
import { ProximaAccionCard } from "@/components/contacto/ProximaAccionCard";
import {
  TareasPendientesCard,
  ContactTask,
} from "@/components/contacto/TareasPendientesCard";
import { AlertasCard, ContactAlert } from "@/components/contacto/AlertasCard";
import { LineaRelacion, Milestone } from "@/components/contacto/LineaRelacion";
import { ContactosVinculadosPanel } from "@/components/contacto/ContactosVinculadosPanel";
import {
  ConversacionFeed,
  ContactMessage,
} from "@/components/contacto/ConversacionFeed";

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

export default function ContactoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [contacto, setContacto] = useState<any>(null);
  const [operador, setOperador] = useState<any>(null);
  const [negociaciones, setNegociaciones] = useState<any[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [tasks, setTasks] = useState<ContactTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [alerts, setAlerts] = useState<ContactAlert[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [briefLoading, setBriefLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefExpanded, setBriefExpanded] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");

  const useMock = searchParams.get("mock") === "1";

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setOwnerId(user?.id ?? null);

    const [
      { data: c },
      { data: negs },
      { data: msgs },
      { data: ts },
      { data: ms },
      { data: as },
    ] = await Promise.all([
      supabase.from("contactos").select("*").eq("id", id).single(),
      supabase
        .from("negociaciones")
        .select("*, operadores(nombre), activos(nombre)")
        .eq("contacto_interlocutor_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("contact_messages")
        .select("*")
        .eq("contact_id", id)
        .order("sent_at", { ascending: false })
        .limit(100),
      supabase
        .from("contact_tasks")
        .select("*")
        .eq("contact_id", id)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(50),
      supabase
        .from("contact_milestones")
        .select("*")
        .eq("contact_id", id)
        .order("event_at", { ascending: true })
        .limit(50),
      supabase
        .from("contact_alerts")
        .select("*")
        .eq("contact_id", id)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false }),
    ]);

    setContacto(c);
    setNegociaciones(negs || []);
    setMessages((msgs || []) as ContactMessage[]);
    setTasks((ts || []) as ContactTask[]);
    setMilestones((ms || []) as Milestone[]);
    setAlerts((as || []) as ContactAlert[]);

    if (c?.operador_id) {
      const { data: op } = await supabase
        .from("operadores")
        .select("id, nombre, sector")
        .eq("id", c.operador_id)
        .single();
      setOperador(op);
    } else {
      setOperador(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const perfil = useMemo(() => {
    if (useMock) return perfilIaMock;
    return parsePerfilIA(contacto?.perfil_ia);
  }, [contacto?.perfil_ia, useMock]);

  const empty = isPerfilEmpty(perfil);
  const proximaAccion = (contacto?.perfil_ia as any)?.proxima_accion ?? null;

  const handleAddNote = () => {
    if (!contacto) return;
    const nombre = `${contacto.nombre || ""} ${contacto.apellidos || ""}`.trim();
    const prompt = `Añade una nota al contacto ${nombre}: `;
    navigate(`/asistente?prompt=${encodeURIComponent(prompt)}`);
  };

  const runExtractor = async () => {
    if (!id) return;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "contact-extract-signals",
        { body: { contact_id: id, force: messages.length > 0 } }
      );
      if (error) throw error;
      toast({
        title: "Análisis IA completado",
        description: `${data?.tasks_created || 0} tareas, ${data?.milestones_created || 0} hitos detectados.`,
      });
      await loadAll();
    } catch (e: any) {
      toast({
        title: "Error en análisis",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const syncEmails = async () => {
    setSyncing(true);
    try {
      const [outlook, gmail] = await Promise.allSettled([
        supabase.functions.invoke("email-sync-outlook", { body: {} }),
        supabase.functions.invoke("email-sync-gmail", { body: {} }),
      ]);
      const okMsgs: string[] = [];
      const errMsgs: string[] = [];
      if (outlook.status === "fulfilled" && !outlook.value.error) {
        okMsgs.push(`Outlook: ${(outlook.value.data as any)?.matched ?? 0}`);
      } else if (outlook.status === "fulfilled") {
        errMsgs.push(`Outlook: ${(outlook.value.error as any)?.message || "error"}`);
      }
      if (gmail.status === "fulfilled" && !gmail.value.error) {
        okMsgs.push(`Gmail: ${(gmail.value.data as any)?.matched ?? 0}`);
      } else if (gmail.status === "fulfilled") {
        errMsgs.push(`Gmail: ${(gmail.value.error as any)?.message || "error"}`);
      }
      toast({
        title: "Sincronización",
        description:
          [...okMsgs, ...errMsgs].join(" · ") || "Sin cambios",
      });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Error sync", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const toggleTask = async (taskId: string, done: boolean) => {
    await supabase
      .from("contact_tasks")
      .update({
        status: done ? "done" : "pending",
        completed_at: done ? new Date().toISOString() : null,
      })
      .eq("id", taskId);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: done ? "done" : "pending" } : t
      )
    );
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !ownerId || !id) return;
    const { error } = await supabase.from("contact_tasks").insert({
      owner_id: ownerId,
      contact_id: id,
      title: newTaskTitle.trim(),
      due_at: newTaskDue ? new Date(newTaskDue).toISOString() : null,
      source: "manual",
      priority: 3,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setNewTaskTitle("");
    setNewTaskDue("");
    setTaskDialogOpen(false);
    loadAll();
  };

  const dismissAlert = async (alertId: string) => {
    await supabase
      .from("contact_alerts")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const generateBrief = async () => {
    if (!contacto) return;
    setBriefLoading(true);
    try {
      const context = [
        `Contacto: ${contacto.nombre} ${contacto.apellidos || ""}`,
        contacto.empresa && `Empresa: ${contacto.empresa}`,
        contacto.cargo && `Cargo: ${contacto.cargo}`,
        contacto.estilo_negociacion &&
          `Estilo negociación: ${
            estiloLabels[contacto.estilo_negociacion] ||
            contacto.estilo_negociacion
          }`,
        contacto.notas_perfil && `Notas: ${contacto.notas_perfil}`,
        operador &&
          `Operador vinculado: ${operador.nombre} (${operador.sector})`,
      ]
        .filter(Boolean)
        .join("\n");

      const milestonesCtx = milestones.length
        ? "\n\nHitos clave:\n" +
          milestones
            .slice(-10)
            .map(
              (m) => `- ${m.event_at.slice(0, 10)} [${m.score}] ${m.title}`
            )
            .join("\n")
        : "";

      const tasksCtx = tasks.filter((t) => t.status === "pending").length
        ? "\n\nTareas pendientes:\n" +
          tasks
            .filter((t) => t.status === "pending")
            .map((t) => `- ${t.title}${t.due_at ? ` (${t.due_at.slice(0, 10)})` : ""}`)
            .join("\n")
        : "";

      const negsContext =
        negociaciones.length > 0
          ? "\n\nHistorial de negociaciones:\n" +
            negociaciones
              .map(
                (n) =>
                  `- Estado: ${n.estado}, Resultado: ${
                    n.resultado || "pendiente"
                  }, Prob. cierre: ${n.probabilidad_cierre ?? "N/A"}%, Notas: ${
                    n.notas || "sin notas"
                  }`
              )
              .join("\n")
          : "";

      const { data, error } = await supabase.functions.invoke(
        "expert-forge-proxy",
        {
          body: {
            action: "chat",
            question: `Genera un brief de negociación profesional para la próxima reunión con este contacto. Incluye: resumen del perfil, puntos clave a tratar, estrategia recomendada según su estilo, riesgos a evitar, y tácticas sugeridas. Sé específico y accionable.`,
            context: `${context}${milestonesCtx}${tasksCtx}${negsContext}`,
          },
        }
      );

      if (error) throw error;
      const reply =
        data?.response ||
        data?.answer ||
        data?.result?.answer ||
        data?.message ||
        "No se pudo generar el brief.";
      setBrief(reply);
      setBriefExpanded(true);
    } catch (err: any) {
      toast({
        title: "Error al generar brief",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBriefLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contacto) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Contacto no encontrado.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/contactos")}
        >
          Volver
        </Button>
      </div>
    );
  }

  const showChartFallback =
    perfil && (!perfil.timeline || perfil.timeline.length < 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/contactos")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {contacto.nombre} {contacto.apellidos || ""}
          </h1>
          <p className="text-sm text-muted-foreground truncate">
            {contacto.cargo ? `${contacto.cargo}` : ""}
            {contacto.cargo && contacto.empresa ? " · " : ""}
            {contacto.empresa || ""}
          </p>
        </div>
        {contacto.estilo_negociacion && (
          <Badge
            variant="secondary"
            className={`${estiloColors[contacto.estilo_negociacion] || ""}`}
          >
            {estiloLabels[contacto.estilo_negociacion] ||
              contacto.estilo_negociacion}
          </Badge>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={runExtractor}
          disabled={extracting}
          className="gap-1.5 bg-accent/10 border-accent/30 hover:bg-accent/20"
        >
          <Brain className={`h-4 w-4 ${extracting ? "animate-pulse" : ""}`} />
          {extracting ? "Analizando..." : "Análisis IA"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddNote}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> Nota
        </Button>
      </div>

      {/* ZONA 1 — Resumen accionable */}
      <div className="grid gap-3 md:grid-cols-3">
        <ProximaAccionCard
          action={proximaAccion}
          onGenerate={runExtractor}
          generating={extracting}
        />
        <TareasPendientesCard
          tasks={tasks}
          onToggle={toggleTask}
          onAdd={() => setTaskDialogOpen(true)}
        />
        <AlertasCard alerts={alerts} onDismiss={dismissAlert} />
      </div>

      {/* ZONA 2 — Línea de la relación (hitos buenos/malos) */}
      <LineaRelacion milestones={milestones} />

      {/* ZONA 3 — Conversaciones (feed unificado) */}
      <ConversacionFeed
        messages={messages}
        onSync={syncEmails}
        syncing={syncing}
      />

      {/* ZONA 4 — Perfil IA detallado (acordeón) */}
      <Accordion type="multiple" defaultValue={["perfil"]} className="space-y-3">
        <AccordionItem
          value="perfil"
          className="border border-border/40 rounded-xl bg-card/40 backdrop-blur-md px-4"
        >
          <AccordionTrigger className="text-sm font-semibold">
            Perfil IA y actividad
          </AccordionTrigger>
          <AccordionContent>
            <PerfilIaSection generatedAt={perfil?.generated_at} empty={empty}>
              {perfil && (
                <div className="space-y-5">
                  {!showChartFallback && (
                    <LineaDeVida timeline={perfil.timeline} />
                  )}
                  {perfil.datos_clave?.length > 0 && (
                    <DatosClaveChips datos={perfil.datos_clave} />
                  )}
                  <div className="grid gap-5 md:grid-cols-2">
                    {perfil.evolution && (
                      <EvolucionReciente evolution={perfil.evolution} />
                    )}
                    {perfil.stats && (
                      <MetricasComunicacion stats={perfil.stats} />
                    )}
                  </div>
                  {perfil.key_events?.length > 0 && (
                    <LineaDelTiempo events={perfil.key_events} />
                  )}
                </div>
              )}
            </PerfilIaSection>

            {(perfil?.perfil_profesional || perfil?.perfil_personal) && (
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                {perfil.perfil_profesional && (
                  <PerfilProfesionalCard data={perfil.perfil_profesional} />
                )}
                {perfil.perfil_personal && (
                  <PerfilPersonalCard
                    data={perfil.perfil_personal}
                    contactoId={contacto.id}
                  />
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="red"
          className="border border-border/40 rounded-xl bg-card/40 backdrop-blur-md px-4"
        >
          <AccordionTrigger className="text-sm font-semibold">
            Red y contactos vinculados
          </AccordionTrigger>
          <AccordionContent>
            {ownerId && (
              <ContactosVinculadosPanel
                contactId={contacto.id}
                ownerId={ownerId}
              />
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="info"
          className="border border-border/40 rounded-xl bg-card/40 backdrop-blur-md px-4"
        >
          <AccordionTrigger className="text-sm font-semibold">
            Información de contacto y notas
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <div className="space-y-2.5">
                {contacto.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${contacto.email}`}
                      className="text-accent hover:underline"
                    >
                      {contacto.email}
                    </a>
                  </div>
                )}
                {contacto.telefono && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{contacto.telefono}</span>
                  </div>
                )}
                {(contacto as any).whatsapp && (
                  <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`https://wa.me/${(contacto as any).whatsapp.replace(
                        /\D/g,
                        ""
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {(contacto as any).whatsapp}
                    </a>
                  </div>
                )}
                {contacto.linkedin_url && (
                  <div className="flex items-center gap-2 text-sm">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={contacto.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline truncate max-w-[200px]"
                    >
                      {contacto.linkedin_url.replace(
                        /https?:\/\/(www\.)?linkedin\.com\/in\/?/,
                        ""
                      )}
                    </a>
                  </div>
                )}
                {operador && (
                  <div className="flex items-center gap-2 text-sm pt-2 border-t border-border/30">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Operador:{" "}
                      <button
                        onClick={() => navigate(`/operadores/${operador.id}`)}
                        className="text-accent hover:underline font-medium"
                      >
                        {operador.nombre}
                      </button>
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {operador.sector}
                    </Badge>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Notas
                </p>
                {contacto.notas_perfil ? (
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">
                    {contacto.notas_perfil}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin notas registradas.
                  </p>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {negociaciones.length > 0 && (
          <AccordionItem
            value="negociaciones"
            className="border border-border/40 rounded-xl bg-card/40 backdrop-blur-md px-4"
          >
            <AccordionTrigger className="text-sm font-semibold">
              Negociaciones ({negociaciones.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-2">
                {negociaciones.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {(n as any).operadores?.nombre || "Sin operador"}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {(n as any).activos?.nombre || "Sin activo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {n.estado}
                      </Badge>
                      {n.probabilidad_cierre != null && (
                        <span className="text-xs text-muted-foreground">
                          {n.probabilidad_cierre}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Brief de Negociación */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Brief de Negociación
          </CardTitle>
          {!brief && (
            <Button
              onClick={generateBrief}
              disabled={briefLoading}
              size="sm"
              className="bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {briefLoading ? "Generando..." : "Generar Brief"}
            </Button>
          )}
          {brief && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBriefExpanded(!briefExpanded)}
            >
              {briefExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </CardHeader>
        {briefLoading && (
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        )}
        {brief && briefExpanded && (
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{brief}</ReactMarkdown>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={generateBrief}
              disabled={briefLoading}
            >
              Regenerar
            </Button>
          </CardContent>
        )}
        {!brief && !briefLoading && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Genera un resumen estratégico para preparar tu próxima reunión
              con este contacto.
            </p>
          </CardContent>
        )}
      </Card>

      {id && <EntityNarrativesPanel entityType="contacto" entityId={id} />}

      {/* Dialog crear tarea */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="¿Qué tienes que hacer?"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              autoFocus
            />
            <Input
              type="datetime-local"
              value={newTaskDue}
              onChange={(e) => setNewTaskDue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTaskDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addTask}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
