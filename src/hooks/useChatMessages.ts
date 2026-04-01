import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  meta?: {
    tools_used?: string[];
    latency_ms?: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

const CONVS_KEY = "ava-conversations";
const ACTIVE_KEY = "ava-active-conv";
const OLD_KEY = "ava-asistente-messages";

function convMessagesKey(id: string) {
  return `ava-conv-${id}`;
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(CONVS_KEY, JSON.stringify(convs));
}

function loadMessages(convId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(convMessagesKey(convId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(convId: string, msgs: ChatMessage[]) {
  localStorage.setItem(convMessagesKey(convId), JSON.stringify(msgs));
}

function migrateOldMessages(): { convs: Conversation[]; activeId: string } {
  let convs = loadConversations();
  let activeId = localStorage.getItem(ACTIVE_KEY) || "";

  // Migrate old single-conversation format
  if (convs.length === 0) {
    const oldRaw = localStorage.getItem(OLD_KEY);
    const now = Date.now();
    const newId = crypto.randomUUID();

    if (oldRaw) {
      try {
        const oldMsgs: ChatMessage[] = JSON.parse(oldRaw);
        if (oldMsgs.length > 0) {
          const conv: Conversation = { id: newId, title: "Conversación anterior", createdAt: now, updatedAt: now };
          convs = [conv];
          saveConversations(convs);
          saveMessages(newId, oldMsgs);
          localStorage.removeItem(OLD_KEY);
          activeId = newId;
          localStorage.setItem(ACTIVE_KEY, activeId);
          return { convs, activeId };
        }
      } catch { /* ignore */ }
    }

    // Create a default conversation
    const conv: Conversation = { id: newId, title: "Nueva conversación", createdAt: now, updatedAt: now };
    convs = [conv];
    saveConversations(convs);
    activeId = newId;
    localStorage.setItem(ACTIVE_KEY, activeId);
  }

  if (!activeId || !convs.find(c => c.id === activeId)) {
    activeId = convs[0]?.id || "";
    localStorage.setItem(ACTIVE_KEY, activeId);
  }

  return { convs, activeId };
}

function toolLabel(tool: string): { emoji: string; label: string } {
  if (tool.startsWith("db_query")) return { emoji: "🔍", label: "Consultando datos" };
  if (tool.startsWith("db_mutate")) return { emoji: "✏️", label: "Modificando datos" };
  if (tool === "expert_forge") return { emoji: "🧠", label: "Preguntando a especialista" };
  if (tool.startsWith("run_intelligence")) return { emoji: "📊", label: "Ejecutando análisis" };
  if (tool === "search_data") return { emoji: "🔎", label: "Buscando datos" };
  return { emoji: "⚙️", label: tool };
}

export { toolLabel };

function getAllMessagesGlobal(convs: Conversation[]): ChatMessage[] {
  const all: ChatMessage[] = [];
  for (const c of convs) {
    const msgs = loadMessages(c.id);
    all.push(...msgs);
  }
  all.sort((a, b) => a.timestamp - b.timestamp);
  return all.slice(-10);
}

export function useChatMessages() {
  const initial = migrateOldMessages();
  const [conversations, setConversations] = useState<Conversation[]>(initial.convs);
  const [activeConversationId, setActiveConversationId] = useState(initial.activeId);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages(initial.activeId));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist conversations list
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Persist active conversation messages
  useEffect(() => {
    if (activeConversationId) {
      saveMessages(activeConversationId, messages);
    }
  }, [messages, activeConversationId]);

  // Persist active id
  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeConversationId);
  }, [activeConversationId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const createConversation = useCallback(() => {
    const now = Date.now();
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: "Nueva conversación",
      createdAt: now,
      updatedAt: now,
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setMessages([]);
    setInput("");
    return newConv.id;
  }, []);

  const switchConversation = useCallback((id: string) => {
    // Save current messages first
    if (activeConversationId) {
      saveMessages(activeConversationId, messages);
    }
    setActiveConversationId(id);
    setMessages(loadMessages(id));
    setInput("");
  }, [activeConversationId, messages]);

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title, updatedAt: Date.now() } : c));
  }, []);

  const deleteConversation = useCallback((id: string) => {
    localStorage.removeItem(convMessagesKey(id));
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        const now = Date.now();
        const newConv: Conversation = { id: crypto.randomUUID(), title: "Nueva conversación", createdAt: now, updatedAt: now };
        setActiveConversationId(newConv.id);
        setMessages([]);
        return [newConv];
      }
      if (id === activeConversationId) {
        const newActive = next[0].id;
        setActiveConversationId(newActive);
        setMessages(loadMessages(newActive));
      }
      return next;
    });
  }, [activeConversationId]);

  const sendMessage = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: q, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    // Auto-title on first message
    if (messages.length === 0) {
      const autoTitle = q.length > 40 ? q.slice(0, 40) + "…" : q;
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, title: autoTitle, updatedAt: Date.now() } : c));
    } else {
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, updatedAt: Date.now() } : c));
    }

    try {
      // Build global history from all conversations
      const globalHistory = getAllMessagesGlobal(conversations);
      const recentMessages = [...globalHistory, userMsg].slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("ava-orchestrator", {
        body: {
          message: q,
          history: recentMessages.slice(0, -1),
        },
      });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: error
          ? `❌ Error: ${error.message}`
          : data?.error
            ? `❌ Error: ${data.error}`
            : data?.answer || "Sin respuesta",
        timestamp: Date.now(),
        meta: (!error && !data?.error) ? {
          tools_used: data?.tools_used,
          latency_ms: data?.latency_ms,
        } : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Error de conexión: ${e instanceof Error ? e.message : "Error desconocido"}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    }
    setLoading(false);
  }, [input, loading, messages, conversations, activeConversationId]);

  const clearChat = () => {
    setMessages([]);
    if (activeConversationId) {
      saveMessages(activeConversationId, []);
    }
  };

  return {
    conversations,
    activeConversationId,
    messages,
    input,
    setInput,
    loading,
    sendMessage,
    clearChat,
    scrollRef,
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
  };
}
