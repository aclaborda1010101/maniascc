import { Bot, Send, Trash2, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatMessages, toolLabel } from "@/hooks/useChatMessages";
import ReactMarkdown from "react-markdown";

export default function AsistenteIA() {
  const { messages, input, setInput, loading, sendMessage, clearChat, scrollRef } = useChatMessages();

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent" /> AVA
          </h1>
          <p className="text-sm text-muted-foreground">Tu asistente inteligente — consulta datos, analiza, modifica registros y más</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1 text-muted-foreground">
            <Trash2 className="h-4 w-4" /> Nueva conversación
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h2 className="text-lg font-semibold text-muted-foreground">¿En qué puedo ayudarte?</h2>
            <p className="text-sm text-muted-foreground/60 max-w-md mt-1">
              Puedo consultar datos de locales, operadores y proyectos, ejecutar análisis de localización o tenant mix, modificar registros y mucho más.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-xl px-4 py-3 ${
              msg.role === "user" ? "bg-accent text-accent-foreground" : "bg-muted"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
              {msg.meta && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.meta.tools_used?.map((t, i) => {
                    const tl = toolLabel(t);
                    return (
                      <Badge key={i} variant="outline" className="text-[10px]">{tl.emoji} {tl.label}</Badge>
                    );
                  })}
                  {msg.meta.latency_ms && (
                    <Badge variant="outline" className="text-[10px]">⏱ {msg.meta.latency_ms}ms</Badge>
                  )}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <User className="h-4 w-4 text-accent-foreground" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-accent animate-pulse" />
            </div>
            <Skeleton className="h-16 w-64 rounded-xl" />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t pt-4 shrink-0">
        <div className="flex gap-2">
          <Input
            placeholder="Pregúntame lo que necesites... puedo consultar datos, analizar, modificar registros..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()} size="icon" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
