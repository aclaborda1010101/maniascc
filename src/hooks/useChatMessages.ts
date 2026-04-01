import { useState, useRef, useEffect, useCallback } from "react";
import { queryExpertForge, type ExpertForgeResponse } from "@/services/expertForge";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  meta?: {
    sources?: ExpertForgeResponse["sources"];
    specialist_used?: string;
    confidence?: number;
    latency_ms?: number;
    model?: string;
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

    const res = await queryExpertForge(q);
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: res.error ? `❌ Error: ${res.error}` : res.answer,
      timestamp: Date.now(),
      meta: res.error ? undefined : {
        sources: res.sources,
        specialist_used: res.specialist_used,
        confidence: res.confidence,
        latency_ms: res.latency_ms,
        model: res.model,
      },
    };
    setMessages(prev => [...prev, assistantMsg]);
    setLoading(false);
  }, [input, loading]);

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { messages, input, setInput, loading, sendMessage, clearChat, scrollRef };
}
