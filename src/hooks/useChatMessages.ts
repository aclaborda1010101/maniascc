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

const STORAGE_KEY = "ava-asistente-messages";

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
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

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: q, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build history from last 10 messages for context
      const recentMessages = [...messages, userMsg].slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("ava-orchestrator", {
        body: {
          message: q,
          history: recentMessages.slice(0, -1), // exclude current message, it's sent as `message`
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
  }, [input, loading, messages]);

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { messages, input, setInput, loading, sendMessage, clearChat, scrollRef };
}
