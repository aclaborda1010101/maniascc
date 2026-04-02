import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Phone, MessageCircle, Linkedin, Building2, Briefcase, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";

const estiloLabels: Record<string, string> = {
  colaborativo: "Colaborativo", competitivo: "Competitivo",
  analitico: "Analítico", expresivo: "Expresivo", evitador: "Evitador",
};
const estiloColors: Record<string, string> = {
  colaborativo: "bg-chart-2/10 text-chart-2", competitivo: "bg-destructive/10 text-destructive",
  analitico: "bg-accent/10 text-accent", expresivo: "bg-chart-3/10 text-chart-3",
  evitador: "bg-muted text-muted-foreground",
};

export default function ContactoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [contacto, setContacto] = useState<any>(null);
  const [operador, setOperador] = useState<any>(null);
  const [negociaciones, setNegociaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefLoading, setBriefLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefExpanded, setBriefExpanded] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const [{ data: c }, { data: negs }] = await Promise.all([
        supabase.from("contactos").select("*").eq("id", id).single(),
        supabase.from("negociaciones").select("*, operadores(nombre), activos(nombre)").eq("contacto_interlocutor_id", id).order("created_at", { ascending: false }).limit(20),
      ]);
      setContacto(c);
      setNegociaciones(negs || []);
      if (c?.operador_id) {
        const { data: op } = await supabase.from("operadores").select("id, nombre, sector").eq("id", c.operador_id).single();
        setOperador(op);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const generateBrief = async () => {
    if (!contacto) return;
    setBriefLoading(true);
    try {
      const context = [
        `Contacto: ${contacto.nombre} ${contacto.apellidos || ""}`,
        contacto.empresa && `Empresa: ${contacto.empresa}`,
        contacto.cargo && `Cargo: ${contacto.cargo}`,
        contacto.estilo_negociacion && `Estilo negociación: ${estiloLabels[contacto.estilo_negociacion] || contacto.estilo_negociacion}`,
        contacto.notas_perfil && `Notas: ${contacto.notas_perfil}`,
        operador && `Operador vinculado: ${operador.nombre} (${operador.sector})`,
      ].filter(Boolean).join("\n");

      const negsContext = negociaciones.length > 0
        ? "\n\nHistorial de negociaciones:\n" + negociaciones.map(n =>
          `- Estado: ${n.estado}, Resultado: ${n.resultado || "pendiente"}, Prob. cierre: ${n.probabilidad_cierre ?? "N/A"}%, Notas: ${n.notas || "sin notas"}`
        ).join("\n")
        : "\nSin negociaciones previas registradas.";

      const { data, error } = await supabase.functions.invoke("ava-orchestrator", {
        body: {
          message: `Genera un brief de negociación profesional para la próxima reunión con este contacto. Incluye: resumen del perfil, puntos clave a tratar, estrategia recomendada según su estilo, riesgos a evitar, y tácticas sugeridas. Sé específico y accionable.\n\nDatos del contacto:\n${context}${negsContext}`
        }
      });

      if (error) throw error;
      setBrief(data?.response || data?.message || "No se pudo generar el brief.");
      setBriefExpanded(true);
    } catch (err: any) {
      toast({ title: "Error al generar brief", description: err.message, variant: "destructive" });
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
        <Button variant="outline" className="mt-4" onClick={() => navigate("/contactos")}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/contactos")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{contacto.nombre} {contacto.apellidos || ""}</h1>
          <p className="text-sm text-muted-foreground">{contacto.cargo ? `${contacto.cargo}` : ""}{contacto.cargo && contacto.empresa ? " · " : ""}{contacto.empresa || ""}</p>
        </div>
        {contacto.estilo_negociacion && (
          <Badge variant="secondary" className={`ml-auto ${estiloColors[contacto.estilo_negociacion] || ""}`}>
            {estiloLabels[contacto.estilo_negociacion] || contacto.estilo_negociacion}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Info Card */}
        <Card>
          <CardHeader><CardTitle className="text-base">Información de contacto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {contacto.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${contacto.email}`} className="text-accent hover:underline">{contacto.email}</a>
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
                <a href={`https://wa.me/${(contacto as any).whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  {(contacto as any).whatsapp}
                </a>
              </div>
            )}
            {contacto.linkedin_url && (
              <div className="flex items-center gap-2 text-sm">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                <a href={contacto.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate max-w-[200px]">
                  {contacto.linkedin_url.replace(/https?:\/\/(www\.)?linkedin\.com\/in\/?/, "")}
                </a>
              </div>
            )}
            {operador && (
              <div className="flex items-center gap-2 text-sm pt-2 border-t">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>Operador: <button onClick={() => navigate(`/operadores/${operador.id}`)} className="text-accent hover:underline font-medium">{operador.nombre}</button></span>
                <Badge variant="outline" className="text-xs">{operador.sector}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Card */}
        <Card>
          <CardHeader><CardTitle className="text-base">Notas / Historial</CardTitle></CardHeader>
          <CardContent>
            {contacto.notas_perfil ? (
              <p className="text-sm whitespace-pre-wrap">{contacto.notas_perfil}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin notas registradas.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Negociaciones */}
      {negociaciones.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Negociaciones ({negociaciones.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {negociaciones.map(n => (
                <div key={n.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{(n as any).operadores?.nombre || "Sin operador"}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{(n as any).activos?.nombre || "Sin activo"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{n.estado}</Badge>
                    {n.probabilidad_cierre != null && (
                      <span className="text-xs text-muted-foreground">{n.probabilidad_cierre}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Brief de Negociación */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Brief de Negociación
          </CardTitle>
          {!brief && (
            <Button onClick={generateBrief} disabled={briefLoading} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Sparkles className="mr-2 h-4 w-4" />
              {briefLoading ? "Generando..." : "Generar Brief"}
            </Button>
          )}
          {brief && (
            <Button variant="ghost" size="sm" onClick={() => setBriefExpanded(!briefExpanded)}>
              {briefExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
            <Button variant="outline" size="sm" className="mt-4" onClick={generateBrief} disabled={briefLoading}>
              Regenerar
            </Button>
          </CardContent>
        )}
        {!brief && !briefLoading && (
          <CardContent>
            <p className="text-sm text-muted-foreground">Genera un resumen estratégico para preparar tu próxima reunión con este contacto.</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
