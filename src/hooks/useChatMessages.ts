import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  if (tool === "expert_forge") return { emoji: "🧠", label: "Preguntando a especialista" };
  if (tool.startsWith("run_intelligence")) return { emoji: "📊", label: "Ejecutando análisis" };
  if (tool === "search_data") return { emoji: "🔎", label: "Buscando datos" };
  if (tool.startsWith("nearby_search")) return { emoji: "📍", label: "Analizando ubicación" };
  if (tool === "generate_pdf_report") return { emoji: "📄", label: "Generando informe" };
  return { emoji: "⚙️", label: tool };
}

export { toolLabel };

export function useChatMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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
        // Migrate from localStorage if any
        const migrated = await migrateLocalStorage(user.id);
        if (cancelled) return;
        if (migrated) {
          setConversations(migrated.convs);
          setActiveConversationId(migrated.activeId);
          if (!cancelled) await loadMessagesFromDb(migrated.activeId);
        } else {
          // Create default
          const newId = await createConversationInDb(user.id, "Nueva conversación");
          if (cancelled) return;
          if (newId) {
            const conv: Conversation = { id: newId, title: "Nueva conversación", createdAt: Date.now(), updatedAt: Date.now() };
            setConversations([conv]);
            setActiveConversationId(newId);
            setMessages([]);
          }
        }
      }
      if (!cancelled) setInitialLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  async function migrateLocalStorage(userId: string): Promise<{ convs: Conversation[]; activeId: string } | null> {
    const CONVS_KEY = "ava-conversations";
    const OLD_KEY = "ava-asistente-messages";
    try {
      const rawConvs = localStorage.getItem(CONVS_KEY);
      const localConvs = rawConvs ? JSON.parse(rawConvs) : [];
      
      if (localConvs.length === 0) {
        const oldRaw = localStorage.getItem(OLD_KEY);
        if (!oldRaw) return null;
        const oldMsgs = JSON.parse(oldRaw);
        if (!oldMsgs.length) return null;
        // Single old conversation
        const newId = await createConversationInDb(userId, "Conversación anterior");
        if (!newId) return null;
        await insertMessagesInDb(newId, oldMsgs);
        localStorage.removeItem(OLD_KEY);
        const conv: Conversation = { id: newId, title: "Conversación anterior", createdAt: Date.now(), updatedAt: Date.now() };
        return { convs: [conv], activeId: newId };
      }

      // Migrate multi-conversation format
      const resultConvs: Conversation[] = [];
      let firstId = "";
      for (const lc of localConvs) {
        const newId = await createConversationInDb(userId, lc.title || "Sin título");
        if (!newId) continue;
        const localMsgs = (() => {
          try {
            const raw = localStorage.getItem(`ava-conv-${lc.id}`);
            return raw ? JSON.parse(raw) : [];
          } catch { return []; }
        })();
        if (localMsgs.length > 0) {
          await insertMessagesInDb(newId, localMsgs);
        }
        resultConvs.push({ id: newId, title: lc.title, createdAt: lc.createdAt || Date.now(), updatedAt: lc.updatedAt || Date.now() });
        if (!firstId) firstId = newId;
        // Clean up localStorage
        localStorage.removeItem(`ava-conv-${lc.id}`);
      }
      localStorage.removeItem(CONVS_KEY);
      localStorage.removeItem("ava-active-conv");

      if (resultConvs.length === 0) return null;
      return { convs: resultConvs, activeId: firstId };
    } catch {
      return null;
    }
  }

  async function createConversationInDb(userId: string, title: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("ava_conversations")
      .insert({ user_id: userId, title })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id;
  }

  async function insertMessagesInDb(convId: string, msgs: ChatMessage[]) {
    const rows = msgs.map(m => ({
      conversation_id: convId,
      role: m.role,
      content: m.content,
      meta: m.meta || {},
    }));
    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      await supabase.from("ava_messages").insert(rows.slice(i, i + 50));
    }
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
    return newId;
  }, [user]);

  const switchConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    await loadMessagesFromDb(id);
    setInput("");
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
        // Will create a new one
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

  const sendMessage = useCallback(async () => {
    const q = input.trim();
    if (!q || loading || !user) return;

    // Insert user message to DB
    const { data: insertedMsg } = await supabase
      .from("ava_messages")
      .insert({ conversation_id: activeConversationId, role: "user", content: q, meta: {} })
      .select("id, created_at")
      .single();

    const userMsg: ChatMessage = {
      id: insertedMsg?.id || crypto.randomUUID(),
      role: "user",
      content: q,
      timestamp: insertedMsg ? new Date(insertedMsg.created_at).getTime() : Date.now(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    // Auto-title on first message
    if (messages.length === 0) {
      const autoTitle = q.length > 40 ? q.slice(0, 40) + "…" : q;
      await supabase.from("ava_conversations").update({ title: autoTitle, updated_at: new Date().toISOString() }).eq("id", activeConversationId);
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, title: autoTitle, updatedAt: Date.now() } : c));
    } else {
      await supabase.from("ava_conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConversationId);
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, updatedAt: Date.now() } : c));
    }

    try {
      // Build recent history from current conversation
      const recentMessages = updatedMessages.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("ava-orchestrator", {
        body: {
          message: q,
          history: recentMessages.slice(0, -1),
        },
      });

      const assistantContent = error
        ? `❌ Error: ${error.message}`
        : data?.error
          ? `❌ Error: ${data.error}`
          : data?.answer || "Sin respuesta";

      const meta = (!error && !data?.error) ? {
        tools_used: data?.tools_used,
        latency_ms: data?.latency_ms,
        ...(data?.pdf_content ? { pdf_content: data.pdf_content, pdf_title: data.pdf_title } : {}),
      } : {};

      // Insert assistant message to DB
      const { data: asstInserted } = await supabase
        .from("ava_messages")
        .insert({ conversation_id: activeConversationId, role: "assistant", content: assistantContent, meta })
        .select("id, created_at")
        .single();

      const assistantMsg: ChatMessage = {
        id: asstInserted?.id || crypto.randomUUID(),
        role: "assistant",
        content: assistantContent,
        timestamp: asstInserted ? new Date(asstInserted.created_at).getTime() : Date.now(),
        meta: meta && Object.keys(meta).length > 0 ? meta as any : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      const errContent = `❌ Error de conexión: ${e instanceof Error ? e.message : "Error desconocido"}`;
      await supabase.from("ava_messages").insert({ conversation_id: activeConversationId, role: "assistant", content: errContent, meta: {} });
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: errContent,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    }
    setLoading(false);
  }, [input, loading, messages, activeConversationId, user]);

  const clearChat = async () => {
    if (activeConversationId) {
      // Delete all messages for this conversation
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
  };
}
