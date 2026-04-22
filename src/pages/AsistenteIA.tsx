import { useState } from "react";
import { useEffect } from "react";
import { Send, Trash2, Sparkles, User, Plus, Pencil, Check, X as XIcon, MessageSquare, FileDown, Loader2, PanelLeftOpen, PanelLeftClose, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useChatMessages, toolLabel } from "@/hooks/useChatMessages";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { generateProfessionalPdf, downloadBlob } from "@/services/pdfService";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { AvaMessageFeedback } from "@/components/AvaMessageFeedback";
import { AvaAttachmentBar } from "@/components/AvaAttachmentBar";
import { AvaPendingActionCard } from "@/components/AvaPendingActionCard";
import { AvaVoiceControls } from "@/components/AvaVoiceControls";
import { AvaRealtimeOverlay, AvaCallButton } from "@/components/AvaRealtimeOverlay";

const SUGGESTIONS = [
  "Resumen del día",
  "Matches calientes",
  "Redacta email a operador",
  "Genera dossier",
  "Próximas tareas",
];

function PdfDownloadButton({ content, title }: { content: string; title?: string }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const handleClick = async () => {
    setExporting(true);
    const docTitle = title || "Informe AVA";
    const { blob, error } = await generateProfessionalPdf(docTitle, content, "Asistente IA");
    if (blob) {
      downloadBlob(blob, `${docTitle}.pdf`);
      toast({ title: "PDF descargado" });
    } else {
      toast({ title: "Error", description: error, variant: "destructive" });
    }
    setExporting(false);
  };
  return (
    <Button variant="outline" size="sm" className="mt-2 gap-1.5 text-xs h-7 px-3 rounded-xl border-accent text-accent" onClick={handleClick} disabled={exporting}>
      {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} Descargar informe PDF
    </Button>
  );
}

function ForgePdfBlock({ forgePdf }: { forgePdf: { mode: string; file_name: string; download_url: string | null; title: string } }) {
  if (!forgePdf.download_url) return null;
  return (
    <a
      href={forgePdf.download_url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1.5 px-3 h-7 rounded-xl border border-accent text-accent hover:bg-accent/10 transition-colors text-xs font-medium"
      download={forgePdf.file_name}
    >
      <Download className="h-3.5 w-3.5" /> Descargar {forgePdf.title || forgePdf.file_name}
    </a>
  );
}

function ConversationList({
  conversations, activeConversationId, editingId, editTitle,
  onSwitch, onStartRename, onConfirmRename, onCancelRename, onEditTitleChange,
  onDelete, onCreate,
}: any) {
  const sortedConvs = [...conversations].sort((a: any, b: any) => b.updatedAt - a.updatedAt);
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <Button onClick={onCreate} variant="outline" size="sm" className="w-full gap-2 rounded-xl">
          <Plus className="h-4 w-4" /> Nueva conversación
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedConvs.map((conv: any) => (
          <div
            key={conv.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2.5 cursor-pointer rounded-2xl hover:bg-muted/60 transition-colors min-h-[44px]",
              conv.id === activeConversationId && "bg-accent/10 border border-accent/30"
            )}
            onClick={() => conv.id !== activeConversationId && onSwitch(conv.id)}
          >
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
            {editingId === conv.id ? (
              <div className="flex-1 flex items-center gap-1">
                <Input
                  value={editTitle}
                  onChange={(e: any) => onEditTitleChange(e.target.value)}
                  onKeyDown={(e: any) => e.key === "Enter" && onConfirmRename()}
                  className="h-6 text-xs px-1"
                  autoFocus
                  onClick={(e: any) => e.stopPropagation()}
                />
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e: any) => { e.stopPropagation(); onConfirmRename(); }}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e: any) => { e.stopPropagation(); onCancelRename(); }}>
                  <XIcon className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-xs truncate">{conv.title}</span>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e: any) => { e.stopPropagation(); onStartRename(conv.id, conv.title); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={(e: any) => { e.stopPropagation(); onDelete(conv.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AsistenteIA() {
  const {
    conversations, activeConversationId, messages, input, setInput,
    loading, sendMessage, clearChat, scrollRef,
    createConversation, switchConversation, renameConversation, deleteConversation,
    pendingAttachments, addAttachments, removeAttachment, resolvePendingAction,
    appendInput, lastAssistantContent,
  } = useChatMessages();
  const { user } = useAuth();
  const userName = (user?.user_metadata?.nombre as string) || user?.email?.split("@")[0] || "";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("ava-conv-sidebar");
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    localStorage.setItem("ava-conv-sidebar", desktopSidebarOpen ? "1" : "0");
  }, [desktopSidebarOpen]);
  const isMobile = useIsMobile();

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

  const handleSwitch = (id: string) => {
    switchConversation(id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleSuggestion = (s: string) => {
    setInput(s);
  };

  const convListProps = {
    conversations, activeConversationId, editingId, editTitle,
    onSwitch: handleSwitch,
    onStartRename: startRename,
    onConfirmRename: confirmRename,
    onCancelRename: () => setEditingId(null),
    onEditTitleChange: setEditTitle,
    onDelete: deleteConversation,
    onCreate: () => { createConversation(); if (isMobile) setSidebarOpen(false); },
  };

  return (
    <div className="flex h-[calc(100vh-6.5rem)] gap-0 -mx-4 md:-mx-0 -mt-4 md:-mt-0">
      {/* Desktop sidebar (collapsible) */}
      {!isMobile && (
        <div className={cn(
          "shrink-0 border-r border-border bg-card/40 overflow-hidden transition-all duration-200",
          desktopSidebarOpen ? "w-64" : "w-0"
        )}>
          <div className="w-64 h-full">
            <ConversationList {...convListProps} />
          </div>
        </div>
      )}

      {/* Mobile sidebar as Sheet */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <ConversationList {...convListProps} />
          </SheetContent>
        </Sheet>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 relative ambient">
        {/* Header — desktop only sleek bar; on mobile we use the hero approach */}
        {!isMobile && (
          <div className="flex items-center justify-between px-3 md:px-8 py-4 shrink-0 relative z-10">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/[0.06]" onClick={() => setDesktopSidebarOpen(v => !v)} title={desktopSidebarOpen ? "Ocultar conversaciones" : "Mostrar conversaciones"}>
                {desktopSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </Button>
              <div className="text-xs text-muted-foreground tracking-wide">
                <span className="text-foreground/85 font-medium">AVA</span>
                <span className="mx-2 opacity-40">/</span>
                <span>Asistente</span>
              </div>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1 text-muted-foreground text-xs rounded-xl hover:bg-white/[0.06]">
                <Trash2 className="h-3.5 w-3.5" /> Limpiar
              </Button>
            )}
          </div>
        )}

        {/* Mobile compact header */}
        {isMobile && messages.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-background/80 backdrop-blur-xl">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-2.5"
            >
              <div className="relative h-9 w-9 rounded-2xl ava-gradient grid place-items-center glow-ring-soft">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold tracking-tight ava-text-gradient">AVA</p>
                <p className="text-[10px] text-muted-foreground">activa · escuchando</p>
              </div>
            </button>
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1 text-muted-foreground text-xs rounded-xl">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 min-h-0">
          {/* Empty state — large hero on mobile, clean on desktop */}
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center min-h-full text-center px-4 py-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 ava-gradient rounded-full blur-2xl opacity-50" />
                <div className="relative h-20 w-20 md:h-24 md:w-24 rounded-3xl ava-gradient grid place-items-center glow-ring">
                  <Sparkles className="h-9 w-9 md:h-11 md:w-11 text-white" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Hola{userName ? `, ${userName}` : ""} 👋
              </h2>
              <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-md">
                ¿En qué te ayudo hoy?
              </p>

              {/* Sugerencias en chips horizontales */}
              <div className="mt-8 w-full max-w-2xl">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSuggestion(s)}
                      className="shrink-0 px-4 py-2 rounded-full bg-card border border-border/60 hover:border-accent/40 hover:bg-accent/5 text-xs md:text-sm text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto w-full">
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.role === "user" ? (
                  <div className="flex gap-3 justify-end items-start">
                    <div className="max-w-[85%] md:max-w-[78%] rounded-3xl px-5 py-3 gradient-iridescent text-white shadow-[0_8px_28px_-12px_hsl(var(--acc-2)/0.45)]">
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    <div className="shrink-0 w-9 h-9 rounded-full bg-white/[0.08] border border-white/10 backdrop-blur-xl grid place-items-center text-[10px] font-semibold text-white/85">
                      {(userName?.[0] || "U").toUpperCase()}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Meta header (logo + name + latency + tokens) */}
                    <div className="flex items-center gap-2.5 pl-1">
                      <div className="relative h-8 w-8 rounded-xl gradient-iridescent grid place-items-center glow-ring-soft shrink-0">
                        <Sparkles className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="text-foreground/80 font-medium">AVA</span>
                        {msg.meta?.latency_ms && <><span className="opacity-40">·</span><span>{msg.meta.latency_ms}ms</span></>}
                      </div>
                    </div>

                    {/* Big glass response panel */}
                    <div className="glass-edge rounded-3xl px-6 py-5 md:px-7 md:py-6 relative">
                      <div className="ava-report prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.meta?.pdf_content && (
                        <PdfDownloadButton content={msg.meta.pdf_content} title={msg.meta.pdf_title} />
                      )}
                      {msg.meta?.forge_pdf && (
                        <ForgePdfBlock forgePdf={msg.meta.forge_pdf} />
                      )}
                      {msg.meta?.pending_action && !msg.meta?.action_resolved && (
                        <AvaPendingActionCard
                          action={msg.meta.pending_action}
                          onResolved={(r) => resolvePendingAction(msg.id, r)}
                        />
                      )}
                      {msg.meta?.action_resolved && (
                        <div className="mt-3 text-[11px] text-muted-foreground">
                          {msg.meta.action_resolved.confirmed
                            ? msg.meta.action_resolved.success
                              ? "✅ Acción confirmada y ejecutada"
                              : `❌ Confirmada pero falló: ${msg.meta.action_resolved.error || "error"}`
                            : "✖️ Acción cancelada por el usuario"}
                        </div>
                      )}
                      {msg.meta?.tools_used && msg.meta.tools_used.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                          {msg.meta.tools_used.map((t: string, i: number) => {
                            const tl = toolLabel(t);
                            return <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-muted-foreground">{tl.emoji} {tl.label}</span>;
                          })}
                        </div>
                      )}
                      <div className="mt-2 -ml-1">
                        <AvaMessageFeedback messageId={msg.id} toolsUsed={msg.meta?.tools_used} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 pl-1">
                  <div className="relative h-8 w-8 rounded-xl gradient-iridescent grid place-items-center glow-ring-soft shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-white animate-pulse" />
                  </div>
                  <span className="text-[11px] text-muted-foreground">AVA está pensando…</span>
                </div>
                <Skeleton className="h-24 w-full rounded-3xl" />
              </div>
            )}
          </div>
        </div>

        {/* Input panel + suggestions */}
        <div
          className="px-3 md:px-8 py-4 md:py-5 shrink-0 space-y-4 max-w-4xl mx-auto w-full"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {pendingAttachments.length > 0 && (
            <AvaAttachmentBar attachments={pendingAttachments} onAdd={addAttachments} onRemove={removeAttachment} disabled={loading} />
          )}

          {/* Big glass input panel */}
          <div className="glass rounded-3xl p-4 md:p-5 relative">
            <Input
              placeholder={`Pregunta a AVA…   (⌘↵ para enviar)`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={loading}
              className="w-full text-sm bg-transparent border-0 px-1 h-10 placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
            />
            <div className="flex items-center justify-between mt-2 pt-2">
              <div className="flex items-center gap-2">
                {pendingAttachments.length === 0 && (
                  <AvaAttachmentBar attachments={[]} onAdd={addAttachments} onRemove={removeAttachment} disabled={loading} />
                )}
                <AvaVoiceControls
                  onTranscript={appendInput}
                  onAutoSend={sendMessage}
                  latestAssistantReply={lastAssistantContent}
                  loading={loading}
                  disabled={loading}
                />
                <AvaCallButton onClick={() => setCallOpen(true)} />
                <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-white/75 hover:bg-white/[0.07] transition-colors">
                  <Sparkles className="h-3 w-3" /> Pro
                </button>
              </div>
              <Button
                onClick={sendMessage}
                disabled={loading || (!input.trim() && pendingAttachments.filter(a => a.status === "ready").length === 0) || pendingAttachments.some(a => a.status === "uploading" || a.status === "processing")}
                size="sm"
                className="pill-iridescent h-9 px-5 rounded-full shrink-0 text-xs font-medium gap-1.5"
              >
                Enviar <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Suggestions grid (below input, like the mockup) */}
          {messages.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase pl-1">Sugerencias</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="glass-edge rounded-full px-4 py-2.5 text-left text-xs text-white/80 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                    <span className="text-accent opacity-60 group-hover:opacity-100 transition-opacity">→</span>
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <AvaRealtimeOverlay open={callOpen} onClose={() => setCallOpen(false)} />
    </div>
  );
}
