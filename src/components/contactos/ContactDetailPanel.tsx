import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MessageCircle, Linkedin, Building2, User, Mic, History, Sparkles } from "lucide-react";
import TabPerfil from "./tabs/TabPerfil";
import TabWhatsApp from "./tabs/TabWhatsApp";
import TabEmail from "./tabs/TabEmail";
import TabPlaud from "./tabs/TabPlaud";
import TabHistorialIA from "./tabs/TabHistorialIA";

const estiloLabels: Record<string, string> = {
  colaborativo: "Colaborativo", competitivo: "Competitivo",
  analitico: "Analítico", expresivo: "Expresivo", evitador: "Evitador",
};
const estiloColors: Record<string, string> = {
  colaborativo: "bg-chart-2/10 text-chart-2", competitivo: "bg-destructive/10 text-destructive",
  analitico: "bg-primary/10 text-primary", expresivo: "bg-chart-3/10 text-chart-3",
  evitador: "bg-muted text-muted-foreground",
};

export default function ContactDetailPanel({ contacto: c, onRefresh }: {
  contacto: any;
  onRefresh: () => void;
}) {
  const [operador, setOperador] = useState<any>(null);
  const [negociaciones, setNegociaciones] = useState<any[]>([]);

  useEffect(() => {
    if (c.operador_id) {
      supabase.from("operadores").select("id, nombre, sector").eq("id", c.operador_id).single()
        .then(({ data }) => setOperador(data));
    } else {
      setOperador(null);
    }
    supabase.from("negociaciones").select("*, operadores(nombre), activos(nombre)")
      .eq("contacto_interlocutor_id", c.id).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setNegociaciones(data || []));
  }, [c.id, c.operador_id]);

  const initials = `${(c.nombre || "?")[0]}${(c.apellidos || "")[0] || ""}`.toUpperCase();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{c.nombre} {c.apellidos || ""}</h2>
            <p className="text-sm text-muted-foreground">
              {c.cargo}{c.cargo && c.empresa ? " · " : ""}{c.empresa || ""}
            </p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {c.estilo_negociacion && (
                <Badge variant="outline" className={`text-[10px] ${estiloColors[c.estilo_negociacion] || ""}`}>
                  {estiloLabels[c.estilo_negociacion] || c.estilo_negociacion}
                </Badge>
              )}
              {c.sentiment && (
                <Badge variant="outline" className="text-[10px]">
                  {c.sentiment === "positivo" ? "😊" : c.sentiment === "negativo" ? "😟" : "😐"} {c.sentiment}
                </Badge>
              )}
              {(c.ai_tags || []).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {c.telefono && (
              <a href={`tel:${c.telefono}`} className="rounded-full p-2 bg-muted hover:bg-muted/80 transition-colors">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </a>
            )}
            {c.whatsapp && (
              <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                className="rounded-full p-2 bg-chart-2/10 hover:bg-chart-2/20 transition-colors">
                <MessageCircle className="h-4 w-4 text-chart-2" />
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="rounded-full p-2 bg-muted hover:bg-muted/80 transition-colors">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </a>
            )}
            {c.linkedin_url && (
              <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="rounded-full p-2 bg-muted hover:bg-muted/80 transition-colors">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
              </a>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>{c.interaction_count || 0} interacciones</span>
          <span>{c.wa_message_count || 0} msgs WA</span>
          <span>{c.plaud_count || 0} grabaciones</span>
          {operador && (
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {operador.nombre}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="perfil" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-5 mt-3 w-auto justify-start gap-1 bg-transparent p-0 border-b rounded-none h-auto pb-0">
          <TabsTrigger value="perfil" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 pb-2">
            <User className="h-3.5 w-3.5" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-chart-2 data-[state=active]:bg-transparent text-xs px-3 pb-2">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            {c.wa_message_count > 0 && <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-1">{c.wa_message_count}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 pb-2">
            <Mail className="h-3.5 w-3.5" /> Email
          </TabsTrigger>
          <TabsTrigger value="plaud" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-chart-3 data-[state=active]:bg-transparent text-xs px-3 pb-2">
            <Mic className="h-3.5 w-3.5" /> Plaud
            {c.plaud_count > 0 && <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-1">{c.plaud_count}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent text-xs px-3 pb-2">
            <Sparkles className="h-3.5 w-3.5" /> Historial IA
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-5">
          <TabsContent value="perfil" className="mt-0">
            <TabPerfil contacto={c} operador={operador} negociaciones={negociaciones} onRefresh={onRefresh} />
          </TabsContent>
          <TabsContent value="whatsapp" className="mt-0">
            <TabWhatsApp contacto={c} onRefresh={onRefresh} />
          </TabsContent>
          <TabsContent value="email" className="mt-0">
            <TabEmail contacto={c} />
          </TabsContent>
          <TabsContent value="plaud" className="mt-0">
            <TabPlaud contacto={c} onRefresh={onRefresh} />
          </TabsContent>
          <TabsContent value="historial" className="mt-0">
            <TabHistorialIA contacto={c} operador={operador} negociaciones={negociaciones} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
