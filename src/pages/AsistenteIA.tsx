import { useState } from "react";
import { Send, Trash2, Sparkles, User, Plus, Pencil, Check, X as XIcon, MessageSquare, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatMessages, toolLabel } from "@/hooks/useChatMessages";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export default function AsistenteIA() {
  const {
    conversations, activeConversationId, messages, input, setInput,
    loading, sendMessage, clearChat, scrollRef,
    createConversation, switchConversation, renameConversation, deleteConversation,
  } = useChatMessages();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const confirmRename = () => {
    if (editingId && editTitle.trim()) {
      renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const sortedConvs = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex h-[calc(100vh-6.5rem)] gap-0">
      {/* Conversation sidebar */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col bg-muted/30">
        <div className="p-3 border-b border-border">
          <Button onClick={createConversation} variant="outline" size="sm" className="w-full gap-2">
            <Plus className="h-4 w-4" /> Nueva conversación
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sortedConvs.map(conv => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-border/50 hover:bg-muted/60 transition-colors",
                conv.id === activeConversationId && "bg-muted"
              )}
              onClick={() => conv.id !== activeConversationId && switchConversation(conv.id)}
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
              {editingId === conv.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <Input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && confirmRename()}
                    className="h-6 text-xs px-1"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); confirmRename(); }}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                    <XIcon className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-xs truncate">{conv.title}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); startRename(conv.id, conv.title); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" /> AVA
            </h1>
            <p className="text-xs text-muted-foreground">Tu asistente inteligente</p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1 text-muted-foreground text-xs">
              <Trash2 className="h-3.5 w-3.5" /> Limpiar chat
            </Button>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 p-6 min-h-0">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h2 className="text-lg font-semibold text-muted-foreground">¿En qué puedo ayudarte?</h2>
              <p className="text-sm text-muted-foreground/60 max-w-md mt-1">
                Puedo consultar datos, ejecutar análisis, modificar registros y mucho más.
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
                      return <Badge key={i} variant="outline" className="text-[10px]">{tl.emoji} {tl.label}</Badge>;
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
        <div className="border-t border-border px-6 py-4 shrink-0">
          <div className="flex gap-2">
            <Input
              placeholder="Pregúntame lo que necesites..."
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
    </div>
  );
}
