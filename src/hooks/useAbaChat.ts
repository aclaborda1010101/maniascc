// ABA chat hook — mirrors useChatMessages but persists to aba_conversations / aba_messages
// and invokes the aba-orchestrator edge function. Supports attachments (image/audio).
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AbaAttachment {
  kind: "image" | "audio";
  data_url: string; // base64 data URL
  name?: string;
}

export interface AbaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  meta?: {
    tools_used?: string[];
    latency_ms?: number;
    pdf_content?: string;
    pdf_title?: string;
    attachments?: { kind: string; name?: string }[];
  };
}

export interface AbaConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export function abaToolLabel(tool: string): { emoji: string; label: string } {
  if (tool.startsWith("db_query")) return { emoji: "🔍", label: "Consultando datos" };
  if (tool === "search_data") return { emoji: "🔎", label: "Buscando (fuzzy)" };
  if (tool.startsWith("rag_search")) return { emoji: "📚", label: "Buscando en RAG" };
  if (tool.startsWith("nearby_search")) return { emoji: "📍", label: "Analizando entorno" };
  if (tool.startsWith("run_intelligence")) return { emoji: "📊", label: "Ejecutando análisis" };
  if (tool === "expert_forge") return { emoji: "🧠", label: "Especialista" };
  if (tool === "generate_pdf_report") return { emoji: "📄", label: "Generando informe" };
  if (tool === "vision_analysis") return { emoji: "🖼️", label: "Analizando imagen" };
  if (tool === "audio_transcription") return { emoji: "🎙️", label: "Transcribiendo audio" };
  return { emoji: "⚙️", label: tool };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function buildAbaAttachment(file: File): Promise<AbaAttachment | null> {
  const url = await fileToDataUrl(file);
  if (file.type.startsWith("image/")) return { kind: "image", data_url: url, name: file.name };
  if (file.type.startsWith("audio/")) return { kind: "audio", data_url: url, name: file.name };
  return null;
}

export function useAbaChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AbaConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<AbaMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AbaAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { setInitialLoading(false); return; }
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      const { data: convRows } = await supabase
        .from("aba_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (convRows && convRows.length > 0) {
        const convs: AbaConversation[] = convRows.map((r: any) => ({
          id: r.id, title: r.title,
          createdAt: new Date(r.created_at).getTime(),
          updatedAt: new Date(r.updated_at).getTime(),
        }));
        setConversations(convs);
        setActiveConversationId(convs[0].id);
        await loadMessages(convs[0].id);
      } else {
        const newId = await createConvDb(user.id, "Nueva conversación");
        if (newId) {
          const conv: AbaConversation = { id: newId, title: "Nueva conversación", createdAt: Date.now(), updatedAt: Date.now() };
          setConversations([conv]);
          setActiveConversationId(newId);
          setMessages([]);
        }
      }
      if (!cancelled) setInitialLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  async function createConvDb(userId: string, title: string): Promise<string | null> {
    const { data } = await supabase
      .from("aba_conversations")
      .insert({ user_id: userId, title })
      .select("id")
      .single();
    return data?.id || null;
  }

  async function loadMessages(convId: string) {
    const { data } = await supabase
      .from("aba_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data.map((r: any) => ({
        id: r.id, role: r.role, content: r.content,
        timestamp: new Date(r.created_at).getTime(),
        meta: r.meta && Object.keys(r.meta).length > 0 ? r.meta : undefined,
      })));
    } else setMessages([]);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const createConversation = useCallback(async () => {
    if (!user) return "";
    const newId = await createConvDb(user.id, "Nueva conversación");
    if (!newId) return "";
    const now = Date.now();
    const newConv: AbaConversation = { id: newId, title: "Nueva conversación", createdAt: now, updatedAt: now };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newId);
    setMessages([]);
    setInput("");
    setAttachments([]);
    return newId;
  }, [user]);

  const switchConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    await loadMessages(id);
    setInput("");
    setAttachments([]);
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await supabase.from("aba_conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title, updatedAt: Date.now() } : c));
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from("aba_conversations").delete().eq("id", id);
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0 && user) {
        createConvDb(user.id, "Nueva conversación").then(newId => {
          if (newId) {
            const now = Date.now();
            setConversations([{ id: newId, title: "Nueva conversación", createdAt: now, updatedAt: now }]);
            setActiveConversationId(newId);
            setMessages([]);
          }
        });
        return [];
      }
      if (id === activeConversationId && next.length > 0) {
        setActiveConversationId(next[0].id);
        loadMessages(next[0].id);
      }
      return next;
    });
  }, [activeConversationId, user]);

  const addAttachment = useCallback(async (file: File) => {
    const att = await buildAbaAttachment(file);
    if (att) setAttachments(prev => [...prev, att].slice(0, 4));
  }, []);

  const removeAttachment = useCallback((idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const sendMessage = useCallback(async () => {
    const q = input.trim();
    if ((!q && attachments.length === 0) || loading || !user) return;

    const attMeta = attachments.map(a => ({ kind: a.kind, name: a.name }));
    const visibleContent = q || `[${attachments.length} adjunto(s) enviado(s)]`;

    const { data: insertedMsg } = await supabase
      .from("aba_messages")
      .insert({ conversation_id: activeConversationId, role: "user", content: visibleContent, meta: attMeta.length ? { attachments: attMeta } : {} })
      .select("id, created_at")
      .single();

    const userMsg: AbaMessage = {
      id: insertedMsg?.id || crypto.randomUUID(),
      role: "user",
      content: visibleContent,
      timestamp: insertedMsg ? new Date(insertedMsg.created_at).getTime() : Date.now(),
      meta: attMeta.length ? { attachments: attMeta } : undefined,
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    const sentAttachments = attachments;
    setInput("");
    setAttachments([]);
    setLoading(true);

    if (messages.length === 0) {
      const autoTitle = (q || "Conversación con adjunto").slice(0, 40);
      await supabase.from("aba_conversations").update({ title: autoTitle, updated_at: new Date().toISOString() }).eq("id", activeConversationId);
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, title: autoTitle, updatedAt: Date.now() } : c));
    } else {
      await supabase.from("aba_conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConversationId);
    }

    try {
      const recent = updated.slice(-20).map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("aba-orchestrator", {
        body: {
          message: q,
          history: recent.slice(0, -1),
          attachments: sentAttachments,
        },
      });

      const assistantContent = error
        ? `❌ Error: ${error.message}`
        : data?.error ? `❌ Error: ${data.error}` : data?.answer || "Sin respuesta";

      const meta = (!error && !data?.error) ? {
        tools_used: data?.tools_used,
        latency_ms: data?.latency_ms,
        ...(data?.pdf_content ? { pdf_content: data.pdf_content, pdf_title: data.pdf_title } : {}),
      } : {};

      const { data: asstInserted } = await supabase
        .from("aba_messages")
        .insert({ conversation_id: activeConversationId, role: "assistant", content: assistantContent, meta })
        .select("id, created_at")
        .single();

      setMessages(prev => [...prev, {
        id: asstInserted?.id || crypto.randomUUID(),
        role: "assistant",
        content: assistantContent,
        timestamp: asstInserted ? new Date(asstInserted.created_at).getTime() : Date.now(),
        meta: meta && Object.keys(meta).length > 0 ? meta as any : undefined,
      }]);
    } catch (e) {
      const errContent = `❌ Error de conexión: ${e instanceof Error ? e.message : "desconocido"}`;
      await supabase.from("aba_messages").insert({ conversation_id: activeConversationId, role: "assistant", content: errContent, meta: {} });
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: errContent, timestamp: Date.now() }]);
    }
    setLoading(false);
  }, [input, attachments, loading, messages, activeConversationId, user]);

  const clearChat = async () => {
    if (activeConversationId) {
      await supabase.from("aba_messages").delete().eq("conversation_id", activeConversationId);
    }
    setMessages([]);
  };

  return {
    conversations, activeConversationId, messages,
    input, setInput, attachments, addAttachment, removeAttachment,
    loading: loading || initialLoading,
    sendMessage, clearChat, scrollRef,
    createConversation, switchConversation, renameConversation, deleteConversation,
  };
}
