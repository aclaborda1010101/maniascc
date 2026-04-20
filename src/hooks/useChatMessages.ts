import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadAvaAttachment, processAvaAttachment, type AvaAttachment } from "@/services/avaAttachmentService";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  meta?: {
    tools_used?: string[];
    latency_ms?: number;
    pdf_content?: string;
    pdf_title?: string;
    forge_pdf?: {
      mode: string;
      file_name: string;
      download_url: string | null;
      title: string;
    };
    attachments?: Array<{ file_name: string; mime_type: string; size?: number }>;
    pending_action?: {
      table: string;
      action: "insert" | "update";
      data: Record<string, any>;
      match: { id?: string } | null;
      summary: string;
    };
    action_resolved?: {
      confirmed: boolean;
      success?: boolean;
      error?: string;
      at: number;
    };
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

function toolLabel(tool: string): { emoji: string; label: string } {
  if (tool.startsWith("db_query")) return { emoji: "🔍", label: "Consultando datos" };
  if (tool.startsWith("db_mutate")) return { emoji: "✏️", label: "Modificando datos" };
  if (tool.startsWith("propose_action")) return { emoji: "🛡️", label: "Acción propuesta" };
  if (tool === "expert_forge") return { emoji: "🧠", label: "Preguntando a especialista" };
  if (tool.startsWith("run_intelligence")) return { emoji: "📊", label: "Ejecutando análisis" };
  if (tool === "search_data") return { emoji: "🔎", label: "Buscando datos" };
  if (tool.startsWith("nearby_search")) return { emoji: "📍", label: "Analizando ubicación" };
  if (tool === "generate_pdf_report") return { emoji: "📄", label: "Generando informe" };
  if (tool.startsWith("generate_forge_document")) return { emoji: "📑", label: "Generando documento FORGE" };
  if (tool === "read_system_document") return { emoji: "📚", label: "Leyendo documento del sistema" };
  return { emoji: "⚙️", label: tool };
}

export { toolLabel };

export function useChatMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingConvs, setLoadingConvs] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [pendingAttachments, setPendingAttachments] = useState<AvaAttachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loading = loadingConvs.has(activeConversationId);

  const markLoading = (convId: string, on: boolean) => {
    setLoadingConvs(prev => {
      const next = new Set(prev);
      if (on) next.add(convId); else next.delete(convId);
      return next;
    });
  };

  // Load conversations from DB
  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      const { data: convRows } = await supabase
        .from("ava_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (convRows && convRows.length > 0) {
        const convs: Conversation[] = convRows.map((r: any) => ({
          id: r.id,
          title: r.title,
          createdAt: new Date(r.created_at).getTime(),
          updatedAt: new Date(r.updated_at).getTime(),
        }));
        setConversations(convs);
        setActiveConversationId(convs[0].id);
        if (!cancelled) await loadMessagesFromDb(convs[0].id);
      } else {
        const newId = await createConversationInDb(user.id, "Nueva conversación");
        if (cancelled) return;
        if (newId) {
          const conv: Conversation = { id: newId, title: "Nueva conversación", createdAt: Date.now(), updatedAt: Date.now() };
          setConversations([conv]);
          setActiveConversationId(newId);
          setMessages([]);
        }
      }
      if (!cancelled) setInitialLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  async function createConversationInDb(userId: string, title: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("ava_conversations")
      .insert({ user_id: userId, title })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id;
  }

  async function loadMessagesFromDb(convId: string) {
    const { data } = await supabase
      .from("ava_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data) {
      const msgs: ChatMessage[] = data.map((r: any) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        timestamp: new Date(r.created_at).getTime(),
        meta: r.meta && Object.keys(r.meta).length > 0 ? r.meta : undefined,
      }));
      setMessages(msgs);
    } else {
      setMessages([]);
    }
  }

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const createConversation = useCallback(async () => {
    if (!user) return "";
    const newId = await createConversationInDb(user.id, "Nueva conversación");
    if (!newId) return "";
    const now = Date.now();
    const newConv: Conversation = { id: newId, title: "Nueva conversación", createdAt: now, updatedAt: now };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newId);
    setMessages([]);
    setInput("");
    setPendingAttachments([]);
    return newId;
  }, [user]);

  const switchConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    await loadMessagesFromDb(id);
    setInput("");
    setPendingAttachments([]);
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await supabase.from("ava_conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title, updatedAt: Date.now() } : c));
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from("ava_conversations").delete().eq("id", id);
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        if (user) {
          createConversationInDb(user.id, "Nueva conversación").then(newId => {
            if (newId) {
              const now = Date.now();
              setConversations([{ id: newId, title: "Nueva conversación", createdAt: now, updatedAt: now }]);
              setActiveConversationId(newId);
              setMessages([]);
            }
          });
        }
        return [];
      }
      if (id === activeConversationId) {
        const newActive = next[0].id;
        setActiveConversationId(newActive);
        loadMessagesFromDb(newActive);
      }
      return next;
    });
  }, [activeConversationId, user]);

  /**
   * Add files as pending attachments. Uploads immediately + processes in background.
   */
  const addAttachments = useCallback(async (files: File[]) => {
    if (!user) return;
    for (const file of files) {
      const localId = crypto.randomUUID();
      const att: AvaAttachment = {
        id: localId,
        storage_path: "",
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size: file.size,
        status: "uploading",
      };
      setPendingAttachments(prev => [...prev, att]);

      const { path, error } = await uploadAvaAttachment(file, user.id);
      if (error || !path) {
        setPendingAttachments(prev => prev.map(a => a.id === localId ? { ...a, status: "error", error: error || "Error subiendo" } : a));
        continue;
      }
      setPendingAttachments(prev => prev.map(a => a.id === localId ? { ...a, storage_path: path, status: "processing" } : a));

      const r = await processAvaAttachment(path, att.mime_type, att.file_name);
      if (!r.success) {
        setPendingAttachments(prev => prev.map(a => a.id === localId ? { ...a, status: "error", error: r.error } : a));
      } else {
        setPendingAttachments(prev => prev.map(a => a.id === localId ? {
          ...a, status: "ready", extracted_text: r.extracted_text, summary: r.summary,
        } : a));
      }
    }
  }, [user]);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const sendMessage = useCallback(async () => {
    const q = input.trim();
    const readyAttachments = pendingAttachments.filter(a => a.status === "ready" || a.status === "error");
    if ((!q && readyAttachments.length === 0) || loading || !user) return;

    // If still processing some, wait
    if (pendingAttachments.some(a => a.status === "uploading" || a.status === "processing")) return;

    const convId = activeConversationId;

    // Implicit feedback detection (correction patterns) → negative feedback on previous assistant
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
    if (q && lastAssistant) {
      const correctionRegex = /\b(te (has |)olvidad|no es correcto|no es cierto|est[áa]s? mal|incorrecto|equivocad|revisa|corrige|err[óo]neo|me ment[íi]ste|falso|en realidad|no tienes raz[óo]n|no hay( superficie| sitio)?|no existe|fall(o|aste)|no me has tenido en cuenta|no has tenido en cuenta|te falt[óo]|te has saltado|olvidaste)\b/i;
      if (correctionRegex.test(q)) {
        supabase.from("ai_feedback" as any).insert({
          entidad_tipo: "ava_message",
          entidad_id: lastAssistant.id,
          usuario_id: user.id,
          feedback_tipo: "thumbs_down",
          correccion_sugerida: q.slice(0, 2000),
          contexto: { source: "implicit_correction", tools_used: lastAssistant.meta?.tools_used || [] },
        } as any).then(() => {
          supabase.from("ai_agent_tasks" as any).insert({
            agente_tipo: "learning_aggregator",
            estado: "pending",
            prioridad: 8,
            entidad_tipo: "ava_message",
            entidad_id: lastAssistant.id,
            parametros: { source: "implicit", timestamp: new Date().toISOString() },
          } as any).then(() => {
            supabase.functions.invoke("ai-learning-aggregator", { body: {} }).catch(() => {});
          });
        });
      }
    }

    // Build attachments_context from ready attachments
    let attachmentsContext = "";
    const attachmentsMeta: Array<{ file_name: string; mime_type: string; size?: number }> = [];
    if (readyAttachments.length > 0) {
      const blocks: string[] = [];
      for (const a of readyAttachments) {
        attachmentsMeta.push({ file_name: a.file_name, mime_type: a.mime_type, size: a.size });
        if (a.status === "error") {
          blocks.push(`### ${a.file_name}\n[ERROR procesando: ${a.error}]`);
        } else {
          const head = a.summary ? `RESUMEN: ${a.summary}\n\n` : "";
          const text = (a.extracted_text || "").slice(0, 30_000);
          blocks.push(`### ${a.file_name} (${a.mime_type})\n${head}CONTENIDO:\n${text}`);
        }
      }
      attachmentsContext = blocks.join("\n\n---\n\n");
    }

    const displayedContent = q || `📎 ${readyAttachments.map(a => a.file_name).join(", ")}`;

    // Insert user message
    const { data: insertedMsg } = await supabase
      .from("ava_messages")
      .insert({
        conversation_id: convId,
        role: "user",
        content: displayedContent,
        meta: attachmentsMeta.length > 0 ? { attachments: attachmentsMeta } : {},
      })
      .select("id, created_at")
      .single();

    const userMsg: ChatMessage = {
      id: insertedMsg?.id || crypto.randomUUID(),
      role: "user",
      content: displayedContent,
      timestamp: insertedMsg ? new Date(insertedMsg.created_at).getTime() : Date.now(),
      meta: attachmentsMeta.length > 0 ? { attachments: attachmentsMeta } : undefined,
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setPendingAttachments([]);
    markLoading(convId, true);

    if (messages.length === 0) {
      const autoTitle = (q || readyAttachments[0]?.file_name || "Conversación").slice(0, 40);
      const titleFinal = autoTitle.length > 38 ? autoTitle + "…" : autoTitle;
      await supabase.from("ava_conversations").update({ title: titleFinal, updated_at: new Date().toISOString() }).eq("id", convId);
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: titleFinal, updatedAt: Date.now() } : c));
    } else {
      await supabase.from("ava_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, updatedAt: Date.now() } : c));
    }

    try {
      const recentMessages = updatedMessages.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("ava-orchestrator", {
        body: {
          message: q || `[Adjunto sin texto: ${readyAttachments.map(a => a.file_name).join(", ")}] Analiza el documento y resume su contenido.`,
          history: recentMessages.slice(0, -1),
          attachments_context: attachmentsContext || undefined,
        },
      });

      const assistantContent = error
        ? `❌ Error: ${error.message}`
        : data?.error
          ? `❌ Error: ${data.error}`
          : data?.answer || "Sin respuesta";

      const meta: any = (!error && !data?.error) ? {
        tools_used: data?.tools_used,
        latency_ms: data?.latency_ms,
        ...(data?.pdf_content ? { pdf_content: data.pdf_content, pdf_title: data.pdf_title } : {}),
        ...(data?.forge_pdf ? { forge_pdf: data.forge_pdf } : {}),
        ...(data?.pending_action ? { pending_action: data.pending_action } : {}),
      } : {};

      const { data: asstInserted } = await supabase
        .from("ava_messages")
        .insert({ conversation_id: convId, role: "assistant", content: assistantContent, meta })
        .select("id, created_at")
        .single();

      const assistantMsg: ChatMessage = {
        id: asstInserted?.id || crypto.randomUUID(),
        role: "assistant",
        content: assistantContent,
        timestamp: asstInserted ? new Date(asstInserted.created_at).getTime() : Date.now(),
        meta: meta && Object.keys(meta).length > 0 ? meta : undefined,
      };
      setMessages(prev => convId === activeConversationId ? [...prev, assistantMsg] : prev);
    } catch (e) {
      const errContent = `❌ Error de conexión: ${e instanceof Error ? e.message : "Error desconocido"}`;
      await supabase.from("ava_messages").insert({ conversation_id: convId, role: "assistant", content: errContent, meta: {} });
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: errContent,
        timestamp: Date.now(),
      };
      setMessages(prev => convId === activeConversationId ? [...prev, errMsg] : prev);
    }
    markLoading(convId, false);
  }, [input, loading, messages, activeConversationId, user, pendingAttachments]);

  const clearChat = async () => {
    if (activeConversationId) {
      await supabase.from("ava_messages").delete().eq("conversation_id", activeConversationId);
    }
    setMessages([]);
  };

  return {
    conversations,
    activeConversationId,
    messages,
    input,
    setInput,
    loading: loading || initialLoading,
    sendMessage,
    clearChat,
    scrollRef,
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
    pendingAttachments,
    addAttachments,
    removeAttachment,
  };
}
