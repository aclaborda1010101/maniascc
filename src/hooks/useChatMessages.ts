import { useState, useRef, useEffect, useCallback } from "react";
import { queryExpertForge, type ExpertForgeResponse } from "@/services/expertForge";
import { queryPatterns } from "@/services/patternService";

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
    jarvis_enriched?: boolean;
  };
}

const STORAGE_KEY = "ava-asistente-messages";

const PATTERN_KEYWORDS = [
  "localización", "localizacion", "ubicación", "ubicacion", "zona", "demograf",
  "tenant mix", "mix comercial", "operador", "inquilino",
  "validación", "validacion", "dossier", "métricas", "metricas", "retorno",
  "negociación", "negociacion", "briefing", "reunión", "reunion",
  "patrón", "patron", "señal", "signal", "benchmark", "riesgo",
];

function shouldQueryPatterns(question: string): boolean {
  const q = question.toLowerCase();
  return PATTERN_KEYWORDS.some(kw => q.includes(kw));
}

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

    // Optionally enrich with JARVIS patterns
    let jarvisContext = "";
    let jarvisEnriched = false;
    if (shouldQueryPatterns(q)) {
      try {
        const patterns = await queryPatterns("full_intelligence", { sector: "centros_comerciales" });
        if (patterns && !patterns.error) {
          const parts: string[] = [];
          if (patterns.success_signals?.length) parts.push(`Señales éxito: ${patterns.success_signals.slice(0, 3).map(s => s.name).join(", ")}`);
          if (patterns.risk_signals?.length) parts.push(`Riesgos: ${patterns.risk_signals.slice(0, 3).map(s => s.name).join(", ")}`);
          if (patterns.model_verdict) parts.push(`Veredicto: ${patterns.model_verdict}`);
          if (parts.length > 0) {
            jarvisContext = `\n\n[Contexto JARVIS Patterns: ${parts.join(" | ")}]`;
            jarvisEnriched = true;
          }
        }
      } catch { /* fail-safe */ }
    }

    const enrichedQuestion = jarvisContext ? `${q}${jarvisContext}` : q;
    const res = await queryExpertForge(enrichedQuestion);

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
        jarvis_enriched: jarvisEnriched,
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
