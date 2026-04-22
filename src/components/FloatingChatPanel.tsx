import { useState } from "react";
import { Send, X, Trash2, Sparkles, Plus, ChevronDown, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatMessages, toolLabel } from "@/hooks/useChatMessages";
import { AvaMessageFeedback } from "@/components/AvaMessageFeedback";
import { AvaAttachmentBar } from "@/components/AvaAttachmentBar";
import { AvaPendingActionCard } from "@/components/AvaPendingActionCard";
import { AvaVoiceControls } from "@/components/AvaVoiceControls";
import { AvaRealtimeOverlay, AvaCallButton } from "@/components/AvaRealtimeOverlay";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface FloatingChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function FloatingChatPanel({ open, onClose }: FloatingChatPanelProps) {
  const [showConvList, setShowConvList] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const {
    conversations, activeConversationId, messages, input, setInput,
    loading, sendMessage, clearChat, scrollRef,
    createConversation, switchConversation,
    pendingAttachments, addAttachments, removeAttachment, resolvePendingAction,
    appendInput, lastAssistantContent,
  } = useChatMessages();

  const activeConv = conversations.find(c => c.id === activeConversationId);
  const sortedConvs = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const processing = pendingAttachments.some(a => a.status === "uploading" || a.status === "processing");

  if (!open) return null;

  return (
    <>
      <div className="w-96 h-[500px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b relative">
          <button
            className="flex items-center gap-1.5 hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors"
            onClick={() => setShowConvList(v => !v)}
          >
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="font-semibold text-xs truncate max-w-[180px]">{activeConv?.title || "AVA"}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { createConversation(); setShowConvList(false); }}>
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Conversation dropdown */}
          {showConvList && (
            <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-b-xl shadow-lg max-h-48 overflow-y-auto z-10">
              {sortedConvs.map(conv => (
                <button
                  key={conv.id}
                  className={`w-full text-left px-4 py-2 text-xs hover:bg-muted/60 transition-colors ${conv.id === activeConversationId ? "bg-muted font-medium" : ""}`}
                  onClick={() => { switchConversation(conv.id); setShowConvList(false); }}
                >
                  {conv.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground">¿En qué puedo ayudarte?</p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="shrink-0 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-accent" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                msg.role === "user" ? "bg-accent text-accent-foreground" : "bg-muted"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                )}

                {/* Attachments badges (user messages) */}
                {msg.meta?.attachments && msg.meta.attachments.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {msg.meta.attachments.map((a, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] px-1 py-0 gap-1">
                        <FileText className="h-2.5 w-2.5" /> {a.file_name}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Forge PDF download block */}
                {msg.meta?.forge_pdf && (
                  <div className="mt-2 p-2 rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-2 mb-1.5">
                      <FileText className="h-3.5 w-3.5 text-accent" />
                      <span className="text-[10px] font-semibold truncate flex-1">{msg.meta.forge_pdf.title}</span>
                    </div>
                    {msg.meta.forge_pdf.download_url ? (
                      <a
                        href={msg.meta.forge_pdf.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={msg.meta.forge_pdf.file_name}
                        className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
                      >
                        <Download className="h-3 w-3" /> Descargar PDF
                      </a>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Generación pendiente</span>
                    )}
                  </div>
                )}

                {msg.meta?.pending_action && !msg.meta?.action_resolved && (
                  <AvaPendingActionCard
                    action={msg.meta.pending_action}
                    onResolved={(r) => resolvePendingAction(msg.id, r)}
                  />
                )}
                {msg.meta?.action_resolved && (
                  <div className="mt-1 text-[9px] text-muted-foreground">
                    {msg.meta.action_resolved.confirmed
                      ? msg.meta.action_resolved.success
                        ? "✅ Ejecutada"
                        : `❌ Falló: ${msg.meta.action_resolved.error || "error"}`
                      : "✖️ Cancelada"}
                  </div>
                )}

                {msg.meta?.tools_used && msg.meta.tools_used.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {msg.meta.tools_used.map((t, i) => {
                      const tl = toolLabel(t);
                      return <Badge key={i} variant="outline" className="text-[9px] px-1 py-0">{tl.emoji} {tl.label}</Badge>;
                    })}
                  </div>
                )}
                {msg.role === "assistant" && (
                  <div className="mt-1">
                    <AvaMessageFeedback messageId={msg.id} toolsUsed={msg.meta?.tools_used} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2">
              <div className="shrink-0 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-accent animate-pulse" />
              </div>
              <Skeleton className="h-10 w-48 rounded-xl" />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-1.5 items-end">
            <AvaAttachmentBar
              attachments={pendingAttachments}
              onAdd={addAttachments}
              onRemove={removeAttachment}
              compact
              disabled={loading}
            />
            <AvaVoiceControls
              onTranscript={appendInput}
              onAutoSend={sendMessage}
              latestAssistantReply={lastAssistantContent}
              loading={loading}
              disabled={loading}
              compact
            />
            <AvaCallButton onClick={() => setCallOpen(true)} compact />
            <Input
              placeholder={processing ? "Procesando adjuntos..." : "Pregúntame o dicta..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={loading}
              className="flex-1 h-8 text-xs"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || processing || (!input.trim() && pendingAttachments.length === 0)}
              size="icon"
              className="h-8 w-8 bg-accent/15 text-foreground border border-accent/25 hover:bg-accent/25 backdrop-blur-md"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <AvaRealtimeOverlay open={callOpen} onClose={() => setCallOpen(false)} />
    </>
  );
}
